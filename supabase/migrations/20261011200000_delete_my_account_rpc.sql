-- Self-service account deletion (logged-in audit #10, RA 10173 right to erasure).
--
-- public.delete_my_account(): SECURITY DEFINER, owned by postgres (which has
-- DELETE on auth.users; checked read-only 2026-10-11), so NO service-role key
-- is needed in the app or env. It deletes ONLY the caller's own data
-- (auth.uid()); there is no user-id parameter, so it can't target anyone else.
--
-- Order: delete app rows explicitly (defence in depth; every FK to auth.users
-- is already ON DELETE CASCADE), then the auth.users row (cascades to
-- auth.sessions/identities/etc.). consent_records are NOT deleted: their
-- user_id FK is ON DELETE SET NULL and the email_hash stays, per the 3-year
-- consent-evidence retention in the privacy notice.
--
-- Idempotent (create or replace + explicit grants). Sorts after every recorded
-- version (latest 20261011120129) and after the pending lesson files
-- (20261011190000-20261011190300). NOT APPLIED.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- App data (own rows only).
  delete from public.diagnostic_answers  where user_id = v_uid;
  delete from public.diagnostic_sessions where user_id = v_uid;
  delete from public.assessment_attempts where user_id = v_uid;
  delete from public.lesson_progress     where user_id = v_uid;
  delete from public.analytics_events    where user_id = v_uid;
  delete from public.profiles            where id      = v_uid;

  -- consent_records: kept; FK sets user_id to NULL, email_hash remains (3-year evidence).

  -- The auth user itself (sessions, identities, factors cascade).
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Self-service deletion of the caller''s own account (auth.uid()). Keeps consent_records (user_id SET NULL + email_hash) for 3 years.';
