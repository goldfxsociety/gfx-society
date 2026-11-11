-- GFX Trading System: access requests (access journey v2, /workspace/gfx/design/trading-system/access-journey-spec.md
-- §5, §9, §12.1). NOT APPLIED. Applying it to production is a separate go-live step that needs Ben's OK, plus QA PASS
-- and Jarvis's go. Apply AFTER 20261111000000_academy_login_membership.sql. Re-runnable. Older migrations untouched.
--
-- What this adds
--  * public.access_requests: one row per request. RLS ON with NO policies and NO grants for anon/authenticated, so the
--    only way in is the SECURITY DEFINER RPCs below, each keyed on auth.uid() (never a client-supplied user id).
--    Emails are stored only as private.email_hash (same pepper as the allowlist). Status: awaiting_email_confirm |
--    pending | matched. No 'expired' state, no expiry column, no auto-delete (Ben: keep request data). Rows go away
--    only when the Academy account is deleted (FK on delete cascade from auth.users; delete_my_account deletes the
--    auth user) or when an admin deletes them on a "Privacy Request".
--  * private.access_request_accm: the raw ACCM email (needed only to send the confirmation link) and the token hash.
--    Private schema, no grants. The raw email is set to null as soon as the link is confirmed.
--    Token = 32 random bytes (hex), stored only as sha256, single-use, expires 24 h after it is issued. That expiry is
--    the TOKEN's only; the request itself never expires.
--  * private.member_join_consent: remembers the join-v2 consent of a confirmed user even when they don't match yet
--    (§4.2: don't ask them to tick again). public.record_member_consent now writes it.
--  * Linking (§5.3): a CONFIRMED ACCM email on a MATCHED request counts as one of the member's emails
--    (private.member_hashes). my_membership, record_member_consent and the import_allowlist grace rules use it.
--  * Monthly refresh: private.import_allowlist (same full-refresh + 14-day grace rules) now also runs
--    private.match_access_requests(), which checks every PENDING request (never an unconfirmed ACCM address), sets
--    'matched' + adds the member on a match, and keeps the row. Returns counts only.
--  * §12.1: no ACCM API exists, so there is no submit-time pull of ACCM data. At submit time the request is checked
--    only against the already-loaded allowlist (covers someone imported after their first verify).
--  * Anti-spam (§9): one active request per user (unique partial index), 3 submits/updates per user and 10 per IP per
--    24 h, 3 confirmation emails per request per 24 h, URLs stripped from the IB name.
-- Unchanged: S8 delisted-owner access, member_status RLS, public.is_member(), grace length.

-- ---------------------------------------------------------------- tables
create table if not exists private.member_join_consent (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  consent_version text not null,
  consented_at    timestamptz not null default now()
);
alter table private.member_join_consent enable row level security;
revoke all on private.member_join_consent from public, anon, authenticated;
comment on table private.member_join_consent is 'GFX members gate: last join consent (version + time) per user, also for users not matched yet.';

create table if not exists public.access_requests (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  academy_email_hash      text not null check (academy_email_hash ~ '^[0-9a-f]{64}$'),
  accm_email_hash         text check (accm_email_hash ~ '^[0-9a-f]{64}$'),
  accm_email_confirmed_at timestamptz,
  ib_name                 text check (char_length(ib_name) between 1 and 60),
  consent_version         text not null,
  status                  text not null check (status in ('awaiting_email_confirm', 'pending', 'matched')),
  matched_via             text check (matched_via in ('academy', 'accm')),
  refresh_checks          int not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  last_checked_at         timestamptz,
  matched_at              timestamptz,
  constraint access_requests_awaiting_has_unconfirmed_accm
    check (status <> 'awaiting_email_confirm' or (accm_email_hash is not null and accm_email_confirmed_at is null)),
  constraint access_requests_confirmed_needs_accm check (accm_email_confirmed_at is null or accm_email_hash is not null),
  constraint access_requests_matched_at check ((status = 'matched') = (matched_at is not null))
);
create unique index if not exists access_requests_one_active on public.access_requests (user_id)
  where status in ('pending', 'awaiting_email_confirm');
create index if not exists access_requests_pending on public.access_requests (status) where status = 'pending';
alter table public.access_requests enable row level security;
revoke all on public.access_requests from public, anon, authenticated;
comment on table public.access_requests is
  'GFX Trading System access requests. Hashed emails only. Kept (no expiry, no auto-delete); deleted with the account or on a Privacy Request. Access only via SECURITY DEFINER RPCs.';

create table if not exists private.access_request_accm (
  request_id       uuid primary key references public.access_requests(id) on delete cascade,
  accm_email       text check (accm_email is null or char_length(accm_email) <= 254),
  token_hash       text check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  token_expires_at timestamptz,
  token_used_at    timestamptz
);
create unique index if not exists access_request_accm_token on private.access_request_accm (token_hash) where token_hash is not null;
alter table private.access_request_accm enable row level security;
revoke all on private.access_request_accm from public, anon, authenticated;
comment on table private.access_request_accm is 'Raw ACCM email only until confirmed (then null) + sha256 of the single-use 24 h confirmation token.';

create table if not exists private.access_request_attempts (
  user_id      uuid not null references auth.users(id) on delete cascade,
  ip_hash      text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists access_request_attempts_user on private.access_request_attempts (user_id, attempted_at);
create index if not exists access_request_attempts_ip on private.access_request_attempts (ip_hash, attempted_at);
alter table private.access_request_attempts enable row level security;
revoke all on private.access_request_attempts from public, anon, authenticated;
comment on table private.access_request_attempts is 'Request submit throttle: user id + hashed IP + time, pruned after 2 days.';

create table if not exists private.accm_confirm_sends (
  request_id uuid not null references public.access_requests(id) on delete cascade,
  sent_at    timestamptz not null default now()
);
create index if not exists accm_confirm_sends_req on private.accm_confirm_sends (request_id, sent_at);
alter table private.accm_confirm_sends enable row level security;
revoke all on private.accm_confirm_sends from public, anon, authenticated;

alter table private.allowlist_refresh_log add column if not exists requests_matched int;
alter table private.allowlist_refresh_log add column if not exists requests_pending int;

-- ---------------------------------------------------------------- helpers (private, no grants)
-- Every email hash that counts for this user: the CONFIRMED current Academy email, plus a CONFIRMED ACCM email on a
-- MATCHED request (the link made at refresh).
create or replace function private.member_hashes(p_uid uuid)
returns setof text language sql stable security definer set search_path = private, public, pg_temp as $$
  select private.email_hash(u.email) from auth.users u
   where u.id = p_uid and u.email_confirmed_at is not null and coalesce(btrim(u.email), '') <> ''
  union
  select r.accm_email_hash from public.access_requests r
   where r.user_id = p_uid and r.status = 'matched' and r.accm_email_confirmed_at is not null and r.accm_email_hash is not null;
$$;
revoke all on function private.member_hashes(uuid) from public, anon, authenticated;

-- IB name hint: drop URLs / bare domains and control characters, squash spaces, max 60 chars; '' -> null.
create or replace function private.clean_ib_name(p text)
returns text language sql immutable set search_path = pg_catalog, pg_temp as $$
  select nullif(left(btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p, ''), '[[:cntrl:]]', ' ', 'g'),
        '\S*(://|www\.)\S*', ' ', 'gi'),
      '\S+\.(com|net|org|io|ph|me|co|info|xyz|link|ly|gg|app|dev|site|online|biz|to|cc|tv)\M\S*', ' ', 'gi'),
    '\s+', ' ', 'g')), 60), '');
$$;
revoke all on function private.clean_ib_name(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- membership (same rules, plus linked ACCM email)
create or replace function public.my_membership()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when auth.uid() is null then 'none'
    when not exists (select 1 from auth.users u
                      where u.id = auth.uid() and u.email_confirmed_at is not null
                        and coalesce(btrim(u.email), '') <> '') then 'none'
    when not exists (select 1 from public.member_status
                      where user_id = auth.uid() and consent_at is not null) then 'none'
    when exists (select 1 from private.member_allowlist a
                  where a.email_hash in (select private.member_hashes(auth.uid()))) then 'active'
    when exists (select 1 from public.member_status
                  where user_id = auth.uid() and allowlist_status = 'grace' and grace_until > now()) then 'grace'
    else 'none' end;
$$;
revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

-- Same contract as 20261111000000; now also remembers join consent for users who don't match yet.
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

  insert into private.member_join_consent (user_id, consent_version, consented_at) values (v_uid, p_version, now())
  on conflict (user_id) do update set consent_version = excluded.consent_version, consented_at = excluded.consented_at;

  select a.role into v_role from private.member_allowlist a
   where a.email_hash in (select private.member_hashes(v_uid))
   order by (a.role = 'ib') desc limit 1;
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

-- ---------------------------------------------------------------- owner RPCs
-- What /system/join needs about the caller only: remembered join consent + their latest request (no hashes, no email).
create or replace function public.my_join_state()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'consent', exists (select 1 from private.member_join_consent c where c.user_id = auth.uid() and c.consent_version = 'join-v2')
            or exists (select 1 from public.member_status m where m.user_id = auth.uid() and m.consent_version = 'join-v2'),
    'request', (select jsonb_build_object('status', r.status, 'created_at', r.created_at, 'updated_at', r.updated_at,
                                          'has_accm_email', r.accm_email_hash is not null,
                                          'accm_confirmed', r.accm_email_confirmed_at is not null,
                                          'ib_name', r.ib_name, 'last_checked_at', r.last_checked_at)
                  from public.access_requests r where r.user_id = auth.uid()
                 order by (r.status <> 'matched') desc, r.created_at desc limit 1))
  where auth.uid() is not null;
$$;
revoke all on function public.my_join_state() from public, anon;
grant execute on function public.my_join_state() to authenticated;

-- Create or update the caller's one active request. Returns 'pending' | 'awaiting_email_confirm' | 'matched' |
-- 'none' (no session) | 'unverified_email' | 'already_member' | 'join_consent_required' | 'invalid_email' |
-- 'same_email' | 'rate_limited'. p_ip is the client IP the server saw (hashed here, never stored raw).
create or replace function public.submit_access_request(p_accm_email text, p_ib_name text, p_consent_version text, p_ip text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_accm text := nullif(lower(btrim(coalesce(p_accm_email, ''))), '');
  v_accm_hash text;
  v_ib text := private.clean_ib_name(p_ib_name);
  v_ip_hash text := private.email_hash('ip:' || coalesce(nullif(btrim(p_ip), ''), 'unknown'));
  v_req public.access_requests%rowtype;
  v_role text;
  v_status text;
  v_consent_at timestamptz;
begin
  if v_uid is null then
    return 'none';
  end if;
  if p_consent_version is distinct from 'request-v1' then
    raise exception 'unknown consent version' using errcode = '22023';
  end if;
  select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_uid;
  if v_email is null or btrim(v_email) = '' or v_confirmed is null then
    return 'unverified_email';
  end if;
  if public.my_membership() <> 'none' then
    return 'already_member';
  end if;
  select c.consented_at into v_consent_at from private.member_join_consent c
   where c.user_id = v_uid and c.consent_version = 'join-v2';
  if v_consent_at is null then
    return 'join_consent_required';
  end if;
  if v_accm is not null then
    if char_length(v_accm) > 254 or v_accm !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      return 'invalid_email';
    end if;
    if v_accm = lower(btrim(v_email)) then
      return 'same_email';
    end if;
    v_accm_hash := private.email_hash(v_accm);
  end if;

  if (select count(*) from private.access_request_attempts where user_id = v_uid and attempted_at > now() - interval '24 hours') >= 3
     or (select count(*) from private.access_request_attempts where ip_hash = v_ip_hash and attempted_at > now() - interval '24 hours') >= 10 then
    return 'rate_limited';
  end if;
  insert into private.access_request_attempts (user_id, ip_hash) values (v_uid, v_ip_hash);
  delete from private.access_request_attempts where attempted_at < now() - interval '2 days';

  select * into v_req from public.access_requests
   where user_id = v_uid and status in ('pending', 'awaiting_email_confirm') for update;

  -- Keep an already-confirmed ACCM email if it didn't change; a new/changed one must be confirmed again.
  if v_accm_hash is null or (v_req.id is not null and v_req.accm_email_hash = v_accm_hash and v_req.accm_email_confirmed_at is not null) then
    v_status := 'pending';
  else
    v_status := 'awaiting_email_confirm';
  end if;

  if v_req.id is null then
    insert into public.access_requests (user_id, academy_email_hash, accm_email_hash, accm_email_confirmed_at, ib_name, consent_version, status)
      values (v_uid, private.email_hash(v_email), v_accm_hash, null, v_ib, p_consent_version, v_status)
      returning * into v_req;
  else
    update public.access_requests set
        academy_email_hash = private.email_hash(v_email),
        accm_email_hash = v_accm_hash,
        accm_email_confirmed_at = case when v_status = 'pending' and v_accm_hash is not null then v_req.accm_email_confirmed_at end,
        ib_name = v_ib, consent_version = p_consent_version, status = v_status, updated_at = now()
      where id = v_req.id returning * into v_req;
  end if;

  if v_status = 'awaiting_email_confirm' then
    -- New/changed address: store it raw (private) for the confirmation email; any older token stops working.
    insert into private.access_request_accm (request_id, accm_email, token_hash, token_expires_at, token_used_at)
      values (v_req.id, v_accm, null, null, null)
    on conflict (request_id) do update set accm_email = excluded.accm_email, token_hash = null, token_expires_at = null, token_used_at = null;
  elsif v_accm_hash is null then
    delete from private.access_request_accm where request_id = v_req.id;
  end if;

  -- §12.1 option A: no ACCM data pull. Only the already-loaded allowlist is checked here, for the Academy email.
  select a.role into v_role from private.member_allowlist a where a.email_hash = private.email_hash(v_email);
  if v_role is not null then
    update public.access_requests set status = 'matched', matched_via = 'academy', matched_at = now(), last_checked_at = now()
     where id = v_req.id;
    delete from private.access_request_accm where request_id = v_req.id and accm_email is not null;
    insert into public.member_status (user_id, allowlist_status, role, member_verified_at, consent_at, consent_version, grace_until)
      values (v_uid, 'active', v_role, now(), v_consent_at, 'join-v2', null)
    on conflict (user_id) do update set allowlist_status = 'active', role = excluded.role, member_verified_at = now(),
        consent_at = excluded.consent_at, consent_version = excluded.consent_version, grace_until = null;
    return 'matched';
  end if;
  return v_status;
end;
$$;
revoke all on function public.submit_access_request(text, text, text, text) from public, anon;
grant execute on function public.submit_access_request(text, text, text, text) to authenticated;

-- Server-side mailer only (service role; NOT anon/authenticated, so a user can never read their own token).
-- Issues a fresh single-use token for the user's request awaiting confirmation; 3 per request per 24 h.
-- Returns {"email": raw ACCM email, "token": raw token} or {"error": "none" | "rate_limited"}. The raw token is
-- returned once and never stored.
create or replace function public.issue_accm_confirm_token(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_req uuid;
  v_email text;
  v_token text;
begin
  select r.id, s.accm_email into v_req, v_email
    from public.access_requests r join private.access_request_accm s on s.request_id = r.id
   where r.user_id = p_user_id and r.status = 'awaiting_email_confirm' and s.accm_email is not null
   for update of s;
  if v_req is null then
    return jsonb_build_object('error', 'none');
  end if;
  if (select count(*) from private.accm_confirm_sends where request_id = v_req and sent_at > now() - interval '24 hours') >= 3 then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  update private.access_request_accm
     set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'), token_expires_at = now() + interval '24 hours', token_used_at = null
   where request_id = v_req;
  insert into private.accm_confirm_sends (request_id) values (v_req);
  delete from private.accm_confirm_sends where sent_at < now() - interval '2 days';
  return jsonb_build_object('email', v_email, 'token', v_token);
end;
$$;
revoke all on function public.issue_accm_confirm_token(uuid) from public, anon, authenticated;
grant execute on function public.issue_accm_confirm_token(uuid) to service_role;

-- Confirmation link landing. The token is the only input and the only proof (it was mailed to the ACCM address).
-- Returns 'confirmed' | 'invalid' (unknown, expired, superseded or malformed: one neutral answer). Re-opening a link
-- that already confirmed its request returns 'confirmed' again, but changes nothing.
create or replace function public.confirm_accm_email(p_token text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hash text;
  v_s private.access_request_accm%rowtype;
  v_r public.access_requests%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return 'invalid';
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select * into v_s from private.access_request_accm where token_hash = v_hash for update;
  if v_s.request_id is null then
    return 'invalid';
  end if;
  select * into v_r from public.access_requests where id = v_s.request_id for update;
  if v_s.token_used_at is not null then
    return case when v_r.accm_email_confirmed_at is not null and v_s.token_expires_at > now() then 'confirmed' else 'invalid' end;
  end if;
  if v_s.token_expires_at is null or v_s.token_expires_at <= now() or v_r.status <> 'awaiting_email_confirm'
     or v_s.accm_email is null or v_r.accm_email_hash is distinct from private.email_hash(v_s.accm_email) then
    return 'invalid';
  end if;
  update public.access_requests set accm_email_confirmed_at = now(), status = 'pending', updated_at = now() where id = v_r.id;
  update private.access_request_accm set token_used_at = now(), accm_email = null where request_id = v_r.id;
  return 'confirmed';
end;
$$;
revoke all on function public.confirm_accm_email(text) from public;
grant execute on function public.confirm_accm_email(text) to anon, authenticated;

-- ---------------------------------------------------------------- monthly refresh
-- Checks every PENDING request against the current allowlist: the user's confirmed Academy email, or the request's
-- confirmed ACCM email. Match -> 'matched' (row kept) + member added; no match -> stays pending, check recorded.
create or replace function private.match_access_requests()
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare
  r record;
  v_matched int := 0;
  v_pending int := 0;
begin
  for r in
    select q.id, q.user_id, q.accm_email_hash, q.accm_email_confirmed_at, q.created_at,
           (select a.role from private.member_allowlist a join auth.users u on u.id = q.user_id
             where u.email_confirmed_at is not null and a.email_hash = private.email_hash(u.email)) as academy_role,
           (select a.role from private.member_allowlist a
             where q.accm_email_confirmed_at is not null and a.email_hash = q.accm_email_hash) as accm_role,
           (select c.consented_at from private.member_join_consent c where c.user_id = q.user_id) as consent_at
      from public.access_requests q where q.status = 'pending' for update of q
  loop
    if coalesce(r.academy_role, r.accm_role) is null then
      update public.access_requests set refresh_checks = refresh_checks + 1, last_checked_at = now() where id = r.id;
      v_pending := v_pending + 1;
    else
      update public.access_requests
         set status = 'matched', matched_via = case when r.academy_role is not null then 'academy' else 'accm' end,
             matched_at = now(), refresh_checks = refresh_checks + 1, last_checked_at = now()
       where id = r.id;
      insert into public.member_status (user_id, allowlist_status, role, member_verified_at, consent_at, consent_version, grace_until)
        values (r.user_id, 'active', case when 'ib' in (r.academy_role, r.accm_role) then 'ib' else 'client' end, now(),
                coalesce(r.consent_at, r.created_at), 'join-v2', null)
      on conflict (user_id) do update set allowlist_status = 'active', role = excluded.role, member_verified_at = now(),
          consent_at = coalesce(public.member_status.consent_at, excluded.consent_at),
          consent_version = coalesce(public.member_status.consent_version, excluded.consent_version), grace_until = null;
      v_matched := v_matched + 1;
    end if;
  end loop;
  return jsonb_build_object('requests_matched', v_matched, 'requests_pending', v_pending);
end;
$$;
revoke all on function private.match_access_requests() from public, anon, authenticated;

-- Full-refresh import (same input/rules as 20261102120000), grace rules now count a linked ACCM email, then the
-- request check runs. Service role / SQL editor only. Returns counts only; never echoes emails.
create or replace function private.import_allowlist(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare
  v_added int; v_unchanged int; v_removed int; v_req jsonb;
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

  -- Members with no listed email left -> 14-day grace; relisted -> active again.
  update public.member_status ms set allowlist_status = 'grace', grace_until = now() + interval '14 days'
   where ms.allowlist_status = 'active'
     and not exists (select 1 from private.member_allowlist a where a.email_hash in (select private.member_hashes(ms.user_id)));
  update public.member_status ms set allowlist_status = 'active', grace_until = null
   where ms.allowlist_status in ('grace', 'removed')
     and exists (select 1 from private.member_allowlist a where a.email_hash in (select private.member_hashes(ms.user_id)));

  v_req := private.match_access_requests();

  insert into private.allowlist_refresh_log (added, unchanged, removed, requests_matched, requests_pending)
    values (v_added, v_unchanged, v_removed, (v_req->>'requests_matched')::int, (v_req->>'requests_pending')::int);
  return jsonb_build_object('added', v_added, 'unchanged', v_unchanged, 'removed', v_removed) || v_req;
end;
$$;
revoke all on function private.import_allowlist(jsonb) from public, anon, authenticated;
