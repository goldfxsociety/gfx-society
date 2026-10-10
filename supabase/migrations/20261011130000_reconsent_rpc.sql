-- ==========================================================
-- Re-consent RPC for logged-in users without a valid consent record. NOT APPLIED.
-- Requires 20261011120000_consent_hardening.sql (applied as 20261010153011:
-- email_hash column, SELECT-only grants for authenticated).
-- Idempotent: CREATE OR REPLACE + re-runnable grants.
--
-- public.record_reconsent(p_marketing boolean):
--   * SECURITY DEFINER, search_path ''. Executable by `authenticated` only.
--   * Inserts ONLY for auth.uid(); user id, email hash (sha256 of lowercased
--     auth.users.email) and consent version are derived on the server. The
--     client only chooses the optional marketing flag.
--   * No duplicate required row: if the user already has a consent_required
--     row for the current version it returns that row's id and inserts nothing
--     (serialised per user with a transaction-scoped advisory lock).
--   * Clients still have NO insert privilege on consent_records.
-- Bump c_version together with SIGNUP_CONSENT_VERSION in src/config/legal.ts.
-- ==========================================================

create or replace function public.record_reconsent(p_marketing boolean default false)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_version constant text := 'signup-consent-v1';
  v_uid uuid := auth.uid();
  v_email text;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('reconsent:' || v_uid::text, 0));

  select id into v_id
  from public.consent_records
  where user_id = v_uid and consent_required and consent_version = c_version
  order by id desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.consent_records
    (user_id, email_hash, consent_version, consent_required, consent_marketing,
     client_consented_at, source)
  values (
    v_uid,
    case when v_email is not null
         then encode(extensions.digest(lower(v_email), 'sha256'), 'hex') end,
    c_version,
    true,
    coalesce(p_marketing, false),
    now(),
    'reconsent'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_reconsent(boolean) from public, anon;
grant execute on function public.record_reconsent(boolean) to authenticated;

-- Keep the table locked down (same as consent hardening): clients read own rows only.
revoke insert, update, delete, truncate, references, trigger
  on table public.consent_records from authenticated;
revoke all on table public.consent_records from anon;
