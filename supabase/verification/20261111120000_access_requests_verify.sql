-- Read-only, catalog only (no table rows, no auth data, no secrets). One result set: (check, ok).
-- BEFORE applying 20261111120000_access_requests.sql: most rows are ok = false (objects missing).
-- AFTER applying: every row must be ok = true. Also re-run 20261111000000_academy_login_membership_verify.sql
-- (must still be all true: this migration redefines my_membership / record_member_consent / import_allowlist).
with f as (
  select p.oid, n.nspname || '.' || p.proname as name, p.prosrc, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') as cfg
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.oid in (
    coalesce(to_regprocedure('public.my_join_state()'), 0)::oid,
    coalesce(to_regprocedure('public.submit_access_request(text,text,text,text)'), 0)::oid,
    coalesce(to_regprocedure('public.issue_accm_confirm_token(uuid)'), 0)::oid,
    coalesce(to_regprocedure('public.confirm_accm_email(text)'), 0)::oid,
    coalesce(to_regprocedure('private.match_access_requests()'), 0)::oid,
    coalesce(to_regprocedure('private.member_hashes(uuid)'), 0)::oid,
    coalesce(to_regprocedure('private.import_allowlist(jsonb)'), 0)::oid,
    coalesce(to_regprocedure('public.my_membership()'), 0)::oid,
    coalesce(to_regprocedure('public.record_member_consent(text)'), 0)::oid)
),
t(name) as (values ('public.access_requests'), ('private.access_request_accm'), ('private.access_request_attempts'),
                   ('private.accm_confirm_sends'), ('private.member_join_consent'))
select 'all 9 functions exist' as check, (select count(*) = 9 from f) as ok
union all
select 'all 9 SECURITY DEFINER', (select count(*) = 9 and bool_and(prosecdef) from f)
union all
select 'search_path pinned (public, pg_temp for public RPCs; private, public, pg_temp for private)',
       (select count(*) = 9 and bool_and(case when name like 'public.%' then cfg = 'search_path=public, pg_temp'
                                              else cfg = 'search_path=private, public, pg_temp' end) from f)
union all
select 'all 5 tables exist with RLS on',
       (select count(*) = 5 and bool_and(c.relrowsecurity) from t join pg_class c on c.oid = to_regclass(t.name))
union all
select 'no anon/authenticated table privileges on any of the 5 tables',
       (select count(*) = 5 and bool_and(not has_table_privilege('anon', t.name, 'select,insert,update,delete')
                                     and not has_table_privilege('authenticated', t.name, 'select,insert,update,delete'))
          from t where to_regclass(t.name) is not null)
union all
select 'access_requests has no RLS policy (RPC-only access, no public read)',
       to_regclass('public.access_requests') is not null
       and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'access_requests')
union all
select 'access_requests status: awaiting_email_confirm | pending | matched only (no expired)',
       exists (select 1 from pg_constraint where conrelid = to_regclass('public.access_requests') and contype = 'c'
                and pg_get_constraintdef(oid) like '%awaiting_email_confirm%pending%matched%'
                and pg_get_constraintdef(oid) not like '%expired%')
union all
select 'access_requests: no plaintext email / expiry / delete-after columns',
       to_regclass('public.access_requests') is not null
       and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'access_requests'
                        and (column_name in ('academy_email', 'accm_email', 'email', 'ip', 'expires_at', 'delete_after')))
union all
select 'one active request per user (unique partial index on user_id)',
       exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'access_requests' and indexname = 'access_requests_one_active'
                and indexdef like 'CREATE UNIQUE INDEX%' and indexdef like '%(user_id)%' and indexdef like '%pending%awaiting_email_confirm%')
union all
select 'access_requests.user_id -> auth.users on delete cascade (account deletion removes the row)',
       exists (select 1 from pg_constraint where conrelid = to_regclass('public.access_requests') and contype = 'f'
                and confrelid = 'auth.users'::regclass and confdeltype = 'c')
union all
select 'owner RPCs: authenticated can execute, anon cannot',
       to_regprocedure('public.my_join_state()') is not null and to_regprocedure('public.submit_access_request(text,text,text,text)') is not null
       and has_function_privilege('authenticated', 'public.my_join_state()', 'execute')
       and has_function_privilege('authenticated', 'public.submit_access_request(text,text,text,text)', 'execute')
       and not has_function_privilege('anon', 'public.my_join_state()', 'execute')
       and not has_function_privilege('anon', 'public.submit_access_request(text,text,text,text)', 'execute')
union all
select 'issue_accm_confirm_token: service_role only (never anon/authenticated)',
       to_regprocedure('public.issue_accm_confirm_token(uuid)') is not null
       and has_function_privilege('service_role', 'public.issue_accm_confirm_token(uuid)', 'execute')
       and not has_function_privilege('anon', 'public.issue_accm_confirm_token(uuid)', 'execute')
       and not has_function_privilege('authenticated', 'public.issue_accm_confirm_token(uuid)', 'execute')
union all
select 'confirm_accm_email: anon + authenticated (token is the only proof)',
       to_regprocedure('public.confirm_accm_email(text)') is not null
       and has_function_privilege('anon', 'public.confirm_accm_email(text)', 'execute')
       and has_function_privilege('authenticated', 'public.confirm_accm_email(text)', 'execute')
union all
select 'private helpers not executable by anon/authenticated',
       (select count(*) = 4 and bool_and(not has_function_privilege('anon', p, 'execute') and not has_function_privilege('authenticated', p, 'execute'))
          from unnest(array['private.match_access_requests()', 'private.member_hashes(uuid)', 'private.import_allowlist(jsonb)',
                            'private.clean_ib_name(text)']) p where to_regprocedure(p) is not null)
union all
select 'token stored as sha256 only (digest in issue + confirm; random 32 bytes)',
       (select coalesce(bool_and(prosrc like '%digest(%sha256%'), false) from f where name in ('public.issue_accm_confirm_token', 'public.confirm_accm_email'))
       and (select coalesce(bool_and(prosrc like '%gen_random_bytes(32)%' and prosrc like '%24 hours%'), false) from f where name = 'public.issue_accm_confirm_token')
union all
select 'submit_access_request: login + confirmed email + not-member + rate limits (3/user, 10/IP per 24 h)',
       (select coalesce(bool_and(prosrc like '%v_confirmed is null%' and prosrc like '%my_membership()%' and prosrc like '%>= 3%'
                                 and prosrc like '%>= 10%' and prosrc like '%24 hours%'), false) from f where name = 'public.submit_access_request')
union all
select 'monthly refresh runs the request check; membership counts linked confirmed ACCM email',
       (select coalesce(bool_and(prosrc like '%private.match_access_requests()%' and prosrc like '%member_hashes%'), false) from f where name = 'private.import_allowlist')
       and (select coalesce(bool_and(prosrc like '%member_hashes%'), false) from f where name = 'public.my_membership')
       and (select coalesce(bool_and(prosrc like '%accm_email_confirmed_at is not null%'), false) from f where name = 'private.member_hashes')
union all
select 'refresh log keeps counts only (requests_matched / requests_pending columns)',
       (select count(*) = 2 from information_schema.columns where table_schema = 'private' and table_name = 'allowlist_refresh_log'
          and column_name in ('requests_matched', 'requests_pending'));
