-- GFX Trading System: Academy password login + consent (Ben via Jarvis, 11 Nov: "reuse yung unang login flow
-- mismo ng academy"). Plan: /workspace/gfx/plans/academy-login-membership-plan.md. NOT APPLIED; needs QA PASS +
-- Jarvis go, and Supabase Auth "Confirm email" must be ON (autoconfirm off) before this is applied (P0).
-- Apply AFTER every existing members/training migration (latest: 20261102230000). Re-runnable.
-- Do not edit older migrations; this file supersedes the OTP-only parts of 20261102130000.
--
-- Membership = any authenticated Supabase session (password /login, email link, or an older OTP session)
--            + CONFIRMED current auth.users.email (email_confirmed_at not null, non-blank)
--            + consent row (member_status.consent_at)
--            + that email's hash on private.member_allowlist ('active'), or an unexpired 14-day grace ('grace').
-- No session_is_otp() anywhere in the member path. No service-role key needed: the allowlist is only read
-- inside SECURITY DEFINER functions keyed on auth.uid() -> auth.users.email (never a client-supplied email,
-- never user_metadata / JWT email). The app never sees the allowlist or the pepper.
--
-- Unchanged on purpose: public.is_member() (wraps my_membership), private.owns_open_course / S8 delisted-owner
-- access, private.import_allowlist (grace rules), member_code_* / purge_member_gate_logs (cron, rollback),
-- public.session_is_otp() (left in place, now unused by the member path).

-- Per-user claim throttle (dropped by 20261102130000), same shape as 20261102120000.
create table if not exists private.member_claim_attempts (
  user_id      uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists member_claim_attempts_user_time on private.member_claim_attempts (user_id, attempted_at);
alter table private.member_claim_attempts enable row level security;
revoke all on private.member_claim_attempts from public, anon, authenticated;
comment on table private.member_claim_attempts is 'GFX members gate: per-user consent/claim attempts (user id + timestamp only), 5/hour, pruned after 1 day.';

-- Effective membership for the caller: 'active' | 'grace' | 'none'.
create or replace function public.my_membership()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when auth.uid() is null then 'none'
    when not exists (select 1 from auth.users u
                      where u.id = auth.uid() and u.email_confirmed_at is not null
                        and coalesce(btrim(u.email), '') <> '') then 'none'
    when not exists (select 1 from public.member_status
                      where user_id = auth.uid() and consent_at is not null) then 'none'
    when exists (select 1 from private.member_allowlist a join auth.users u on u.id = auth.uid()
                  where a.email_hash = private.email_hash(u.email)) then 'active'
    when exists (select 1 from public.member_status
                  where user_id = auth.uid() and allowlist_status = 'grace' and grace_until > now()) then 'grace'
    else 'none' end;
$$;
revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

-- Consent + allowlist claim for the caller only (any authenticated session with a confirmed email).
-- Returns 'active' | 'no_match' | 'unverified_email' | 'rate_limited' | 'none' (not logged in).
create or replace function public.record_member_consent(p_version text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_role text;
begin
  if v_uid is null then
    return 'none';
  end if;
  -- Only the current consent text version is accepted (keep in sync with MEMBERS_CONSENT_VERSION).
  if p_version is distinct from 'join-v2' then
    raise exception 'unknown consent version' using errcode = '22023';
  end if;

  select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_uid;
  if v_email is null or btrim(v_email) = '' or v_confirmed is null then
    return 'unverified_email';
  end if;

  if (select count(*) from private.member_claim_attempts
        where user_id = v_uid and attempted_at > now() - interval '1 hour') >= 5 then
    return 'rate_limited';
  end if;
  insert into private.member_claim_attempts (user_id) values (v_uid);
  delete from private.member_claim_attempts where attempted_at < now() - interval '1 day';

  select a.role into v_role from private.member_allowlist a where a.email_hash = private.email_hash(v_email);
  if v_role is null then
    return 'no_match';
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

-- RLS: own row only; no OTP AMR requirement.
drop policy if exists member_status_select_own on public.member_status;
create policy member_status_select_own on public.member_status
  for select to authenticated using (user_id = (select auth.uid()));
