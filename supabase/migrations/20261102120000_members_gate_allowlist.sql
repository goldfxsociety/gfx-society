-- GFX Trading System, PR 1: members-only gate + private allowlist (NOT APPLIED; needs Ben's own-words OK).
--
-- Design (proposal v5 §2-§3):
--  * private.member_allowlist stores ONLY sha256(pepper || normalized email) + role ('ib'|'client').
--    No plaintext email, no name/balance/deposit/volume/account no. The `private` schema is not
--    exposed by PostgREST, and all privileges are revoked from anon/authenticated on top of that.
--  * The pepper lives in private.app_settings (generated once here with gen_random_bytes, never
--    printed, never in env or the client bundle).
--  * public.member_status(user_id, member_verified_at, allowlist_status, role) holds the result per
--    user; RLS lets a user read only their own row. Writes only via SECURITY DEFINER functions.
--  * public.claim_membership(p_consent boolean): matches ONLY the caller's own auth email, ONLY if
--    that email is confirmed (email_confirmed_at not null), consent must be true, rate-limited to
--    5 attempts / hour per user. Returns 'matched' | 'no_match' | 'rate_limited' | 'unverified_email'.
--    No email parameter, so it can't be used to enumerate other people's emails.
--  * private.import_allowlist(jsonb): full-refresh import for Jarvis/Ben (service role / SQL editor
--    only, NOT callable by anon/authenticated). Input: [{"email":..,"role":..}]. Hashes server-side,
--    returns counts only {added, unchanged, removed}. Removed members get allowlist_status='grace'
--    (14-day grace per §3 [A]); expiry is enforced at read time by public.my_membership().
--  * private.allowlist_refresh_log keeps date + counts only (§3.6).
-- Guarded and re-runnable: IF NOT EXISTS / create or replace / explicit grants.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_settings (
  key   text primary key,
  value text not null
);
revoke all on private.app_settings from public, anon, authenticated;
insert into private.app_settings (key, value)
  values ('allowlist_pepper', encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (key) do nothing;

create table if not exists private.member_allowlist (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  role       text not null check (role in ('ib', 'client')),
  added_at   timestamptz not null default now(),
  seen_at    timestamptz not null default now()
);
alter table private.member_allowlist enable row level security;
revoke all on private.member_allowlist from public, anon, authenticated;

create table if not exists private.allowlist_refresh_log (
  id         bigint generated always as identity primary key,
  run_at     timestamptz not null default now(),
  added      int not null,
  unchanged  int not null,
  removed    int not null
);
revoke all on private.allowlist_refresh_log from public, anon, authenticated;

create table if not exists private.member_claim_attempts (
  user_id      uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists member_claim_attempts_user_time on private.member_claim_attempts (user_id, attempted_at);
revoke all on private.member_claim_attempts from public, anon, authenticated;

create table if not exists public.member_status (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  allowlist_status   text not null check (allowlist_status in ('active', 'grace', 'removed')),
  role               text check (role in ('ib', 'client')),
  member_verified_at timestamptz not null default now(),
  consent_at         timestamptz not null,
  grace_until        timestamptz
);
alter table public.member_status enable row level security;
revoke all on public.member_status from public, anon, authenticated;
grant select on public.member_status to authenticated;
drop policy if exists member_status_select_own on public.member_status;
create policy member_status_select_own on public.member_status
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.email_hash(p_email text)
returns text language sql stable security definer set search_path = private, pg_temp as $$
  select encode(extensions.digest(
    (select value from private.app_settings where key = 'allowlist_pepper') || lower(btrim(p_email)),
    'sha256'), 'hex');
$$;
revoke all on function private.email_hash(text) from public, anon, authenticated;

create or replace function public.claim_membership(p_consent boolean)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_role text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_consent is not true then
    raise exception 'consent required' using errcode = '22023';
  end if;
  select email, email_confirmed_at into v_email, v_confirmed from auth.users where id = v_uid;
  if v_email is null or v_confirmed is null then
    return 'unverified_email';
  end if;
  if (select count(*) from private.member_claim_attempts
        where user_id = v_uid and attempted_at > now() - interval '1 hour') >= 5 then
    return 'rate_limited';
  end if;
  insert into private.member_claim_attempts (user_id) values (v_uid);
  delete from private.member_claim_attempts where attempted_at < now() - interval '1 day';

  select role into v_role from private.member_allowlist where email_hash = private.email_hash(v_email);
  if v_role is null then
    return 'no_match';
  end if;
  insert into public.member_status (user_id, allowlist_status, role, member_verified_at, consent_at, grace_until)
    values (v_uid, 'active', v_role, now(), now(), null)
  on conflict (user_id) do update
    set allowlist_status = 'active', role = excluded.role, consent_at = now(), grace_until = null;
  return 'matched';
end;
$$;
revoke all on function public.claim_membership(boolean) from public, anon;
grant execute on function public.claim_membership(boolean) to authenticated;

-- Effective membership for the caller: 'active' | 'grace' | 'none'. Grace past grace_until = 'none'.
create or replace function public.my_membership()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case
      when allowlist_status = 'active' then 'active'
      when allowlist_status = 'grace' and grace_until > now() then 'grace'
      else 'none' end
    from public.member_status where user_id = auth.uid()), 'none');
$$;
revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

-- Full-refresh import. Service role / SQL editor only. Returns counts only; never echoes emails.
create or replace function private.import_allowlist(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare
  v_added int; v_unchanged int; v_removed int;
begin
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

  -- Members whose email is no longer listed -> 14-day grace; relisted -> active again.
  update public.member_status ms set allowlist_status = 'grace', grace_until = now() + interval '14 days'
    from auth.users u
   where u.id = ms.user_id and ms.allowlist_status = 'active'
     and not exists (select 1 from private.member_allowlist a where a.email_hash = private.email_hash(u.email));
  update public.member_status ms set allowlist_status = 'active', grace_until = null
    from auth.users u
   where u.id = ms.user_id and ms.allowlist_status in ('grace', 'removed')
     and exists (select 1 from private.member_allowlist a where a.email_hash = private.email_hash(u.email));

  insert into private.allowlist_refresh_log (added, unchanged, removed) values (v_added, v_unchanged, v_removed);
  return jsonb_build_object('added', v_added, 'unchanged', v_unchanged, 'removed', v_removed);
end;
$$;
revoke all on function private.import_allowlist(jsonb) from public, anon, authenticated;

comment on table private.member_allowlist is 'GFX members gate: sha256(pepper||email) + role only. No PII.';
comment on table public.member_status is 'Per-user GFX Trading System membership result. Own-row read only.';
