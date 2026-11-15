-- Read-only. One result set: (check, ok). Returns no emails, hashes or row data: only catalog facts and booleans.
-- Run BEFORE and AFTER applying 20261115120000_explorer_linked_tiers.sql, and after the revert.
-- 18 rows, three prefixes: 'pre:' / 'unchanged:' / no prefix = must hold always; 'apply:' = the migration is in;
-- 'revert:' = the three redefined public functions have their exact live 15 Nov 2026 bodies.
-- BEFORE apply (prod as of 15 Nov 2026): the 6 always rows and the 3 'revert:' rows are true (9 rows); all 9
--   'apply:' rows are false.
-- AFTER apply: the 6 always rows and the 9 'apply:' rows are true (15 rows); the 3 'revert:' rows are false by design.
-- AFTER the revert (supabase/scripts/20261115_explorer_linked_tiers/revert.sql): same as BEFORE (9 true, 'apply:' false).
-- scripts/qa/pglite-explorer-linked-tiers.mjs asserts all three sets.
with fn as (
  select p.oid, n.nspname || '.' || p.proname as name, md5(p.prosrc) as m, p.prosrc, p.prosecdef,
         coalesce(array_to_string(p.proconfig, ','), '') as cfg
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.oid in (
     coalesce(to_regprocedure('private.upsert_allowlist(jsonb,text,text)'), 0)::oid,
     coalesce(to_regprocedure('private.import_allowlist_full(jsonb,text,text)'), 0)::oid,
     coalesce(to_regprocedure('private.activate_consented_members()'), 0)::oid,
     coalesce(to_regprocedure('private.hash_owners()'), 0)::oid,
     coalesce(to_regprocedure('private.explorer_course(uuid)'), 0)::oid,
     coalesce(to_regprocedure('private.join_consented(uuid)'), 0)::oid,
     coalesce(to_regprocedure('private.import_actor(text)'), 0)::oid,
     coalesce(to_regprocedure('private.clean_source_file(text)'), 0)::oid,
     coalesce(to_regprocedure('private.import_allowlist(jsonb)'), 0)::oid,
     coalesce(to_regprocedure('private.match_access_requests()'), 0)::oid,
     coalesce(to_regprocedure('public.has_course_access(uuid)'), 0)::oid,
     coalesce(to_regprocedure('public.my_payment_info(text)'), 0)::oid,
     coalesce(to_regprocedure('public.submit_access_request(text,text,text,text)'), 0)::oid)
), newfn as (
  select * from fn where name in ('private.upsert_allowlist', 'private.import_allowlist_full', 'private.activate_consented_members',
                                  'private.explorer_course', 'private.join_consented', 'private.import_actor', 'private.clean_source_file',
                                  'private.hash_owners')
), logcols as (
  select array_agg(column_name::text order by column_name) as c from information_schema.columns
   where table_schema = 'private' and table_name = 'allowlist_refresh_log'
)
select 'pre: Gold Reset course row is open and free (slug gold-reset, price 0)' as check,
       exists (select 1 from public.training_courses where slug = 'gold-reset' and status = 'open' and price_php = 0) as ok
union all
select 'pre: paid courses gold-strategy-basics + gold-advanced-setups have a price > 0',
       (select count(*) from public.training_courses where slug in ('gold-strategy-basics', 'gold-advanced-setups') and price_php > 0) = 2
union all
select 'monthly import_allowlist body unchanged (md5 of the live 15 Nov body)',
       coalesce((select m = 'ac526943f1975f3be087350bf900d16f' from fn where name = 'private.import_allowlist'), false)
union all
select 'match_access_requests body unchanged (md5 of the live 15 Nov body)',
       coalesce((select m = '252ce0b1289b29c27ef329532e95c9cf' from fn where name = 'private.match_access_requests'), false)
union all
select 'private schema: anon/authenticated have no USAGE',
       not has_schema_privilege('anon', 'private', 'usage') and not has_schema_privilege('authenticated', 'private', 'usage')
union all
select 'apply: all 8 new private functions exist',
       (select count(*) from newfn) = 8
union all
select 'apply: no new function is executable by anon or authenticated',
       (select count(*) from newfn) = 8
       and not exists (select 1 from newfn where has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'))
union all
select 'apply: new SECURITY DEFINER functions pin search_path',
       (select count(*) from newfn) = 8
       and not exists (select 1 from newfn where prosecdef and cfg not like 'search_path=%')
union all
select 'apply: upsert_allowlist never deletes from the allowlist and never starts grace',
       coalesce((select prosrc !~* 'delete\s+from\s+private\.member_allowlist' and prosrc !~* 'allowlist_status\s*=\s*''grace'''
                   from fn where name = 'private.upsert_allowlist'), false)
union all
select 'apply: has_course_access has the consented-Explorer Gold Reset branch',
       coalesce((select prosrc like '%private.explorer_course(p_course_id)%' and prosrc like '%private.join_consented(auth.uid())%'
                   from fn where name = 'public.has_course_access'), false)
union all
select 'apply: my_payment_info lets a consented Explorer see Gold Reset',
       coalesce((select prosrc like '%private.explorer_course(c.id)%' and prosrc like '%private.join_consented(auth.uid())%'
                   from fn where name = 'public.my_payment_info'), false)
union all
select 'unchanged: has_course_access + my_payment_info + submit_access_request keep grants (authenticated yes, anon no) and SECURITY DEFINER',
       (select count(*) from fn where name in ('public.has_course_access', 'public.my_payment_info', 'public.submit_access_request')
           and prosecdef and cfg = 'search_path=public, pg_temp'
           and has_function_privilege('authenticated', oid, 'execute') and not has_function_privilege('anon', oid, 'execute')) = 3
union all
select 'apply: submit_access_request accepts request-v1 + request-v2 (live body, one line changed; md5)',
       coalesce((select m = '45419dcecbb48ed1db7689ccb434914c' from fn where name = 'public.submit_access_request'), false)
union all
select 'apply: allowlist_refresh_log has mode, source_file, actor, updated, consented_activated, conflicts, skipped',
       (select c @> array['actor', 'conflicts', 'consented_activated', 'mode', 'skipped', 'source_file', 'updated'] from logcols)
union all
select 'apply: allowlist_refresh_log has no email / account-id style column',
       (select c @> array['mode'] and not exists (select 1 from unnest(c) x where x ~* '(email|account|user_id|name|balance|deposit)') from logcols)
union all
select 'revert: has_course_access body is the live 15 Nov body (md5)',
       coalesce((select m = '5c19835b884faeb0743116d75cb287a9' from fn where name = 'public.has_course_access'), false)
union all
select 'revert: my_payment_info body is the live 15 Nov body (md5)',
       coalesce((select m = '96bbcf2c9095dd4fb99aa6016a2c2081' from fn where name = 'public.my_payment_info'), false)
union all
select 'revert: submit_access_request body is the live 15 Nov body (md5, accepts request-v1 only)',
       coalesce((select m = 'da445ef25e6a78018d00afb84dd1fe67' from fn where name = 'public.submit_access_request'), false);
