-- Verify 20261011130426_delete_my_account_rpc.sql (applied to prod 2026-10-11 as version 20261011130426) (read-only).

-- 1) Function shape: SECURITY DEFINER, pinned search_path, owner postgres, no args. Expect 1 row, all true.
select p.prosecdef                                   as security_definer,
       p.proconfig::text like '%search_path=public, pg_temp%' as search_path_pinned,
       pg_get_userbyid(p.proowner) = 'postgres'      as owner_postgres,
       p.pronargs = 0                                as no_arguments
from pg_proc p
where p.oid = 'public.delete_my_account()'::regprocedure;

-- 2) Execute grants: authenticated only. Expect anon=false, public=false, authenticated=true.
select has_function_privilege('anon',          'public.delete_my_account()', 'execute') as anon_can_execute,
       has_function_privilege('authenticated', 'public.delete_my_account()', 'execute') as authenticated_can_execute,
       exists (select 1 from information_schema.routine_privileges
               where routine_schema = 'public' and routine_name = 'delete_my_account'
                 and grantee = 'PUBLIC')                                              as public_can_execute;

-- 3) consent_records survives deletion: FK is ON DELETE SET NULL. Expect 'n'.
select c.confdeltype as consent_fk_delete_rule
from pg_constraint c
where c.conrelid = 'public.consent_records'::regclass and c.contype = 'f'
  and c.confrelid = 'auth.users'::regclass;

-- 4) The definer can delete auth users. Expect true.
select has_table_privilege('postgres', 'auth.users', 'DELETE') as owner_can_delete_auth_users;

-- 5) AFTER the manual test (see PR test plan), with the throwaway user's id:
-- select
--   (select count(*) from auth.users            where id = '<uid>') as auth_users,          -- 0
--   (select count(*) from public.profiles       where id = '<uid>') as profiles,            -- 0
--   (select count(*) from public.lesson_progress where user_id = '<uid>') as progress,      -- 0
--   (select count(*) from public.diagnostic_sessions where user_id = '<uid>') as sessions,  -- 0
--   (select count(*) from public.consent_records
--      where email_hash = encode(extensions.digest(lower('<throwaway email>'), 'sha256'), 'hex')
--        and user_id is null) as consent_kept;                                              -- >= 1
