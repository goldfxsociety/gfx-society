-- ==========================================================
-- Security hardening. FILE ONLY — NOT APPLIED. Founder applies after review.
-- Fixes Supabase advisor lints 0028/0029 (SECURITY DEFINER functions executable
-- by anon/authenticated via /rest/v1/rpc), pins search_path, and stops users
-- from editing privileged profile columns (e.g. `role`).
-- Live ACLs observed 10 Oct 2026 (read-only): all 5 functions had EXECUTE for
-- PUBLIC and/or anon, authenticated, service_role.
-- ==========================================================

begin;

-- 1. Diagnostic RPCs: signed-in users only (each already checks auth.uid()).
revoke execute on function public.submit_diagnostic_answer(uuid, uuid, integer) from public, anon;
revoke execute on function public.skip_diagnostic_question(uuid, uuid) from public, anon;
revoke execute on function public.get_diagnostic_results(uuid) from public, anon;
grant  execute on function public.submit_diagnostic_answer(uuid, uuid, integer) to authenticated;
grant  execute on function public.skip_diagnostic_question(uuid, uuid) to authenticated;
grant  execute on function public.get_diagnostic_results(uuid) to authenticated;
alter function public.submit_diagnostic_answer(uuid, uuid, integer) set search_path = public, pg_temp;
alter function public.skip_diagnostic_question(uuid, uuid) set search_path = public, pg_temp;
alter function public.get_diagnostic_results(uuid) set search_path = public, pg_temp;

-- 2. Trigger / event-trigger functions: never callable through the API.
--    Triggers still fire (they run as the table/event owner, not via EXECUTE grants).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
-- handle_new_user only references public.profiles (fully qualified) -> empty search_path is safe.
alter function public.handle_new_user() set search_path = '';
-- rls_auto_enable already pins search_path = pg_catalog (unchanged).

-- 3. Future functions in public: no automatic EXECUTE for anon/public.
alter default privileges in schema public revoke execute on functions from public, anon;

-- 4. profiles: the "update own profile" policy allows every column, including `role`
--    and `referred_by_code`. Limit client updates to user-editable columns.
--    (App code currently only SELECTs display_name; no client update path exists.)
revoke update on public.profiles from anon, authenticated;
grant  update (display_name, certificate_name, avatar_url) on public.profiles to authenticated;

commit;

-- Verify after applying (read-only):
--   select proname, array_to_string(proacl, ',') from pg_proc
--   where pronamespace = 'public'::regnamespace order by 1;
-- Then re-run Supabase Advisors > Security; lints 0028/0029 should clear.
