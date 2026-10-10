-- Verify 20261011130000_reconsent_rpc.sql (read-only except step 4, which rolls back).

-- 1) Function security: SECURITY DEFINER, search_path pinned, owner.
select p.proname, p.prosecdef as security_definer, p.proconfig as config,
       pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'record_reconsent';

-- 2) Who can execute it. Expect: anon false, authenticated true, public false.
select r.rolname,
       has_function_privilege(r.rolname, 'public.record_reconsent(boolean)', 'execute') as can_execute
from pg_roles r where r.rolname in ('anon', 'authenticated', 'public', 'service_role')
union all
select 'PUBLIC', exists (
  select 1 from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.record_reconsent(boolean)'::regprocedure and a.grantee = 0);

-- 3) Table grants. Expect authenticated = SELECT only; no anon row.
select grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'consent_records'
group by grantee order by grantee;

-- 4) Self-only insert + idempotency check. Run in the SQL editor as one block;
--    it impersonates a real user via request.jwt.claims and ROLLS BACK.
--    Replace the uuid with an existing test user's id.
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
--   select public.record_reconsent(false) as first_id;
--   select public.record_reconsent(true)  as second_id;   -- expect same id (no duplicate)
--   select count(*) as my_required_rows from public.consent_records
--     where user_id = auth.uid() and consent_required and source = 'reconsent';  -- expect 1
--   -- direct insert must fail (no INSERT privilege):
--   insert into public.consent_records (user_id, consent_version) values (auth.uid(), 'x');  -- expect: permission denied
-- rollback;

-- 5) Anonymous call must fail: as anon, `select public.record_reconsent();` -> permission denied.
