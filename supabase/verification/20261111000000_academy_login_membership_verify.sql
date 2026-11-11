-- Read-only, catalog only (no table rows, no auth data, no secrets). One result set: (check, ok).
-- BEFORE applying 20261111000000_academy_login_membership.sql: expect ok = false on the "no OTP" and
-- "claim table" rows (current OTP-only state); every other row true.
-- AFTER applying: every row must be ok = true.
with f as (
  select p.oid, p.proname, p.prosrc, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') as cfg
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.oid in (coalesce(to_regprocedure('public.my_membership()'), 0)::oid,
                  coalesce(to_regprocedure('public.record_member_consent(text)'), 0)::oid)
)
select 'my_membership + record_member_consent exist' as check,
       (select count(*) = 2 from f) as ok
union all
select 'both SECURITY DEFINER', (select count(*) = 2 and bool_and(prosecdef) from f)
union all
select 'both pin search_path=public, pg_temp', (select count(*) = 2 and bool_and(cfg = 'search_path=public, pg_temp') from f)
union all
select 'no session_is_otp in my_membership / record_member_consent', (select count(*) = 2 and bool_and(prosrc not like '%session_is_otp%') from f)
union all
select 'both require email_confirmed_at', (select count(*) = 2 and bool_and(prosrc like '%email_confirmed_at is not null%' or prosrc like '%v_confirmed is null%') from f)
union all
select 'record_member_consent has per-user claim limit', (select coalesce(bool_and(prosrc like '%private.member_claim_attempts%' and prosrc like '%rate_limited%'), false) from f where proname = 'record_member_consent')
union all
select 'anon cannot execute my_membership / record_member_consent',
       to_regprocedure('public.my_membership()') is not null and to_regprocedure('public.record_member_consent(text)') is not null
       and not has_function_privilege('anon', 'public.my_membership()', 'execute')
       and not has_function_privilege('anon', 'public.record_member_consent(text)', 'execute')
union all
select 'authenticated can execute my_membership / record_member_consent / is_member',
       to_regprocedure('public.is_member()') is not null
       and has_function_privilege('authenticated', 'public.my_membership()', 'execute')
       and has_function_privilege('authenticated', 'public.record_member_consent(text)', 'execute')
       and has_function_privilege('authenticated', 'public.is_member()', 'execute')
union all
select 'claim table private.member_claim_attempts exists, RLS on, no anon/authenticated privileges',
       to_regclass('private.member_claim_attempts') is not null
       and (select relrowsecurity from pg_class where oid = to_regclass('private.member_claim_attempts'))
       and not has_table_privilege('anon', 'private.member_claim_attempts', 'select,insert,update,delete')
       and not has_table_privilege('authenticated', 'private.member_claim_attempts', 'select,insert,update,delete')
union all
select 'member_status_select_own: own row, no OTP',
       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_status'
                and policyname = 'member_status_select_own' and roles = '{authenticated}'
                and qual not like '%session_is_otp%' and qual like '%auth.uid()%')
union all
select 'member_status RLS on; allowlist + email_hash not reachable by anon/authenticated',
       (select relrowsecurity from pg_class where oid = 'public.member_status'::regclass)
       and not has_table_privilege('authenticated', 'private.member_allowlist', 'select')
       and not has_table_privilege('anon', 'private.member_allowlist', 'select')
       and not has_function_privilege('authenticated', 'private.email_hash(text)', 'execute')
       and not has_function_privilege('anon', 'private.email_hash(text)', 'execute')
union all
select 'S8 delisted-owner path intact (owns_open_course + keep_bought_courses_after_delist)',
       to_regprocedure('private.owns_open_course(uuid,uuid)') is not null
       and to_regprocedure('private.keep_bought_courses_after_delist()') is not null;
