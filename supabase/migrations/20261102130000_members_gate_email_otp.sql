-- GFX Trading System, PR 1 follow-up: one-step passwordless email-code gate (Ben's redesign, 2 Nov,
-- via Jarvis). Supersedes the claim step from 20261102120000. NOT APPLIED; needs Ben's own-words OK.
-- Apply AFTER 20261102120000_members_gate_allowlist.sql. Re-runnable.
--
-- Flow: /system/join -> member types their ACCM email + ticks consent -> server calls
-- public.member_code_allowed(email, ip) (service_role only, boolean) -> only if true, Supabase Auth
-- signInWithOtp sends a 6-digit code -> verifyOtp(type 'email') -> session JWT amr = [{method:'otp'}]
-- -> public.record_member_consent(version) -> members area.
--
-- Rules enforced here (not only in the UI):
--  * Access needs a session established by email OTP: auth.jwt()->'amr' must contain method 'otp'
--    (Supabase Auth verify.go issues models.OTP => "otp" for POST /verify; password sessions get
--    "password"). A squatter who autoconfirm-signed-up a member's email with a password is denied.
--  * Allowlist is re-checked on every members request via the hash of the CURRENT session email,
--    so email changes and list removals apply immediately (14-day grace only for list removals,
--    set by import_allowlist).
--  * Send gate returns a boolean only, rate-limited 3/hour per email hash and 10/hour per IP hash;
--    the app always shows the same neutral message. The gate only CHECKS the limits; a slot is
--    used (public.member_code_record) only after Supabase Auth accepted the send. CAPTCHA/Auth
--    rejections go to a separate per-IP-only bucket (20/hour), so junk tokens from a stranger
--    can never use up a member's per-email slots.
--  * Logs keep hashes + timestamps only, deleted after 1 day (daily cron + on every send).

-- Old claim step: no longer used.
drop function if exists public.claim_membership(boolean);
drop table if exists private.member_claim_attempts;

alter table public.member_status add column if not exists consent_version text;
-- member_verified_at = last successful OTP verification; consent_at/consent_version = consent record.

create table if not exists private.member_code_requests (
  email_hash   text not null,
  ip_hash      text not null,
  requested_at timestamptz not null default now()
);
create index if not exists member_code_requests_email on private.member_code_requests (email_hash, requested_at);
create index if not exists member_code_requests_ip on private.member_code_requests (ip_hash, requested_at);
revoke all on private.member_code_requests from public, anon, authenticated;

-- Per-IP-only bucket for sends that Supabase Auth rejected (bad/missing CAPTCHA etc.). No email.
create table if not exists private.member_code_rejects (
  ip_hash     text not null,
  rejected_at timestamptz not null default now()
);
create index if not exists member_code_rejects_ip on private.member_code_rejects (ip_hash, rejected_at);
revoke all on private.member_code_rejects from public, anon, authenticated;

-- True only when the current session was established by email OTP.
create or replace function public.session_is_otp()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select coalesce(exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(auth.jwt()->'amr') = 'array' then auth.jwt()->'amr' else '[]'::jsonb end) a
    where a->>'method' = 'otp'), false);
$$;
revoke all on function public.session_is_otp() from public, anon;
grant execute on function public.session_is_otp() to authenticated;

create or replace function public.purge_member_gate_logs()
returns jsonb language plpgsql security definer set search_path = private, pg_temp as $$
declare v int; r int;
begin
  with d as (delete from private.member_code_requests where requested_at < now() - interval '1 day' returning 1)
    select count(*) into v from d;
  with d as (delete from private.member_code_rejects where rejected_at < now() - interval '1 day' returning 1)
    select count(*) into r from d;
  return jsonb_build_object('code_requests', v, 'code_rejects', r);
end;
$$;
revoke all on function public.purge_member_gate_logs() from public, anon, authenticated;
grant execute on function public.purge_member_gate_logs() to service_role;

-- Server-only send gate. Boolean only; never says why. Checks limits but uses no slot.
create or replace function public.member_code_allowed(p_email text, p_ip text)
returns boolean language plpgsql security definer set search_path = private, pg_temp as $$
declare
  v_eh text := private.email_hash(coalesce(p_email, ''));
  v_ih text := private.email_hash('ip:' || coalesce(p_ip, 'unknown'));
begin
  perform public.purge_member_gate_logs();
  if coalesce(btrim(p_email), '') = '' then return false; end if;
  if (select count(*) from private.member_code_requests where email_hash = v_eh and requested_at > now() - interval '1 hour') >= 3
     or (select count(*) from private.member_code_requests where ip_hash = v_ih and requested_at > now() - interval '1 hour') >= 10
     or (select count(*) from private.member_code_rejects where ip_hash = v_ih and rejected_at > now() - interval '1 hour') >= 20 then
    return false;
  end if;
  return exists (select 1 from private.member_allowlist where email_hash = v_eh);
end;
$$;
revoke all on function public.member_code_allowed(text, text) from public, anon, authenticated;
grant execute on function public.member_code_allowed(text, text) to service_role;

-- Server-only, called after the send attempt: accepted -> uses an email + IP slot;
-- rejected (CAPTCHA/Auth) -> per-IP reject bucket only, never the email bucket.
create or replace function public.member_code_record(p_email text, p_ip text, p_accepted boolean)
returns void language plpgsql security definer set search_path = private, pg_temp as $$
declare v_ih text := private.email_hash('ip:' || coalesce(p_ip, 'unknown'));
begin
  if p_accepted is true and coalesce(btrim(p_email), '') <> '' then
    insert into private.member_code_requests (email_hash, ip_hash) values (private.email_hash(p_email), v_ih);
  else
    insert into private.member_code_rejects (ip_hash) values (v_ih);
  end if;
end;
$$;
revoke all on function public.member_code_record(text, text, boolean) from public, anon, authenticated;
grant execute on function public.member_code_record(text, text, boolean) to service_role;

-- Effective membership: 'active' | 'grace' | 'none'.
create or replace function public.my_membership()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when auth.uid() is null or not public.session_is_otp() then 'none'
    when not exists (select 1 from public.member_status where user_id = auth.uid() and consent_at is not null) then 'none'
    when exists (select 1 from private.member_allowlist a join auth.users u on u.id = auth.uid()
                  where a.email_hash = private.email_hash(u.email)) then 'active'
    when exists (select 1 from public.member_status where user_id = auth.uid()
                  and allowlist_status = 'grace' and grace_until > now()) then 'grace'
    else 'none' end;
$$;
revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

-- After verifyOtp: record consent (timestamp + version). Requires OTP session + listed email.
create or replace function public.record_member_consent(p_version text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_role text;
begin
  if v_uid is null or not public.session_is_otp() then
    return 'none';
  end if;
  -- Only the current consent text version is accepted (keep in sync with MEMBERS_CONSENT_VERSION).
  if p_version is distinct from 'join-v2' then
    raise exception 'unknown consent version' using errcode = '22023';
  end if;
  select a.role into v_role from private.member_allowlist a join auth.users u on u.id = v_uid
   where a.email_hash = private.email_hash(u.email);
  if v_role is null then
    return 'none';
  end if;
  insert into public.member_status (user_id, allowlist_status, role, member_verified_at, consent_at, consent_version, grace_until)
    values (v_uid, 'active', v_role, now(), now(), p_version, null)
  on conflict (user_id) do update
    set allowlist_status = 'active', role = excluded.role, member_verified_at = now(),
        consent_at = now(), consent_version = excluded.consent_version, grace_until = null;
  return 'active';
end;
$$;
revoke all on function public.record_member_consent(text) from public, anon;
grant execute on function public.record_member_consent(text) to authenticated;

-- RLS: own row, and only from an OTP session.
drop policy if exists member_status_select_own on public.member_status;
create policy member_status_select_own on public.member_status
  for select to authenticated using (user_id = (select auth.uid()) and (select public.session_is_otp()));

-- P3-2: import safe to call twice in one transaction.
create or replace function private.import_allowlist(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare
  v_added int; v_unchanged int; v_removed int;
begin
  drop table if exists pg_temp._incoming;
  create temp table _incoming on commit drop as
    select distinct on (h) h as email_hash, r as role from (
      select private.email_hash(e->>'email') as h, lower(btrim(e->>'role')) as r
      from jsonb_array_elements(p_rows) e
      where coalesce(btrim(e->>'email'), '') <> '' and lower(btrim(e->>'role')) in ('ib', 'client')
    ) s order by h, r;

  select count(*) into v_unchanged from _incoming i join private.member_allowlist a using (email_hash);
  v_added := (select count(*) from _incoming) - v_unchanged;

  with gone as (
    delete from private.member_allowlist a
    where not exists (select 1 from _incoming i where i.email_hash = a.email_hash)
    returning a.email_hash)
  select count(*) into v_removed from gone;

  insert into private.member_allowlist (email_hash, role)
    select email_hash, role from _incoming
  on conflict (email_hash) do update set role = excluded.role, seen_at = now();

  update public.member_status ms set allowlist_status = 'grace', grace_until = now() + interval '14 days'
    from auth.users u
   where u.id = ms.user_id and ms.allowlist_status = 'active'
     and not exists (select 1 from private.member_allowlist a where a.email_hash = private.email_hash(u.email));
  update public.member_status ms set allowlist_status = 'active', grace_until = null
    from auth.users u
   where u.id = ms.user_id and ms.allowlist_status in ('grace', 'removed')
     and exists (select 1 from private.member_allowlist a where a.email_hash = private.email_hash(u.email));

  drop table if exists pg_temp._incoming;
  insert into private.allowlist_refresh_log (added, unchanged, removed) values (v_added, v_unchanged, v_removed);
  return jsonb_build_object('added', v_added, 'unchanged', v_unchanged, 'removed', v_removed);
end;
$$;
revoke all on function private.import_allowlist(jsonb) from public, anon, authenticated;

comment on table private.member_code_requests is 'GFX members gate: code-send rate limit (accepted sends only). Hashes + timestamp only; deleted after 1 day.';
comment on table private.member_code_rejects is 'GFX members gate: per-IP bucket for rejected sends (CAPTCHA/Auth). IP hash + timestamp only; deleted after 1 day.';
