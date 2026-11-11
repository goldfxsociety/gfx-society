-- GFX Trading System: different-ACCM-email confirmation, hardening for the Gmail SMTP mailer (stacked on
-- 20261111120000_access_requests.sql, PR #67). NOT APPLIED. Written to run on a database where 20261111120000 is
-- ALREADY applied (PR #67 deploys first), with QA PASS and Jarvis's go. Re-runnable. 20261111120000 is not edited;
-- the four functions below are redefined in full (create or replace, same signatures, so no caller breaks).
--
-- What this changes (QA notes on PR #67 a1f394a)
--  * N3/N6 DB-side switch: private.app_settings key 'accm_confirm_mail_live' (default 'false'). While it is not
--    'true': submit_access_request refuses a non-null ACCM email ('accm_email_disabled', nothing stored, no try
--    counted), so no raw ACCM email is stored and no request can reach 'awaiting_email_confirm';
--    issue_accm_confirm_token issues nothing; confirm_accm_email answers 'invalid'. Set it to 'true' only at go-live
--    with Jarvis's go, together with ACCM_CONFIRM_MAIL_LIVE in src/lib/members/access-request.ts.
--    One-time cleanup while the switch is off: any raw ACCM email stored by a direct RPC call before this migration
--    is deleted and its request goes back to 'pending' without an ACCM email.
--  * N1: confirm_accm_email now needs the signed-in requester. Only authenticated callers; the token's request must
--    belong to auth.uid(). Any mismatch (no session, other account, unknown/expired/used token) gets the same neutral
--    'invalid' and the token is NOT consumed. The page confirms only on a POST (button), never on the GET render.
--  * N2: the monthly refresh also checks the Academy email of requests that are still 'awaiting_email_confirm'.
--    An unconfirmed ACCM address is still never checked or linked. On an Academy match the raw ACCM address is deleted.
--  * N7 (unchanged, info): p_ip is passed by the server action, but a direct RPC caller controls it, so the
--    10-per-IP limit is advisory. The 3-per-user limit holds.

insert into private.app_settings (key, value) values ('accm_confirm_mail_live', 'false')
  on conflict (key) do nothing;

-- True only when the switch is exactly 'true'. Missing row / any other value -> false (fail closed).
create or replace function private.accm_confirm_mail_live()
returns boolean language sql stable security definer set search_path = private, public, pg_temp as $$
  select coalesce((select s.value = 'true' from private.app_settings s where s.key = 'accm_confirm_mail_live'), false);
$$;
revoke all on function private.accm_confirm_mail_live() from public, anon, authenticated;

-- One-time cleanup (only while the switch is off): no raw ACCM email may sit in the private table.
do $$
begin
  if not private.accm_confirm_mail_live() then
    update public.access_requests r set status = 'pending', accm_email_hash = null, accm_email_confirmed_at = null, updated_at = now()
     where r.status = 'awaiting_email_confirm';
    delete from private.access_request_accm where accm_email is not null;
  end if;
end $$;

-- Same contract as 20261111120000, plus: a non-null ACCM email is refused while the switch is off.
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
    -- N3: no ACCM email is stored (and no 'awaiting_email_confirm') unless the confirmation mailer is live.
    if not private.accm_confirm_mail_live() then
      return 'accm_email_disabled';
    end if;
    if char_length(v_accm) > 254 or v_accm !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      return 'invalid_email';
    end if;
    if v_accm = lower(btrim(v_email)) then
      return 'same_email';
    end if;
    v_accm_hash := private.email_hash(v_accm);
  end if;

  -- N7: the per-IP limit is advisory (p_ip is caller-supplied on a direct RPC call); the per-user limit holds.
  if (select count(*) from private.access_request_attempts where user_id = v_uid and attempted_at > now() - interval '24 hours') >= 3
     or (select count(*) from private.access_request_attempts where ip_hash = v_ip_hash and attempted_at > now() - interval '24 hours') >= 10 then
    return 'rate_limited';
  end if;
  insert into private.access_request_attempts (user_id, ip_hash) values (v_uid, v_ip_hash);
  delete from private.access_request_attempts where attempted_at < now() - interval '2 days';

  select * into v_req from public.access_requests
   where user_id = v_uid and status in ('pending', 'awaiting_email_confirm') for update;

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
    insert into private.access_request_accm (request_id, accm_email, token_hash, token_expires_at, token_used_at)
      values (v_req.id, v_accm, null, null, null)
    on conflict (request_id) do update set accm_email = excluded.accm_email, token_hash = null, token_expires_at = null, token_used_at = null;
  elsif v_accm_hash is null then
    delete from private.access_request_accm where request_id = v_req.id;
  end if;

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

-- Server-side mailer only (service role via the Next.js server action; NOT anon/authenticated, so a user can never
-- read or set their own token). Same contract as 20261111120000, plus: nothing is issued while the switch is off.
create or replace function public.issue_accm_confirm_token(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_req uuid;
  v_email text;
  v_token text;
begin
  if not private.accm_confirm_mail_live() then
    return jsonb_build_object('error', 'none');
  end if;
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

-- N1: POST-only confirm (the page calls this from a button's server action), bound to the requester's session.
-- Returns 'confirmed' | 'invalid'. 'invalid' covers: switch off, no session, malformed/unknown/expired/superseded
-- token, and a token that belongs to another account. A mismatch never consumes the token and never says whose it is.
create or replace function public.confirm_accm_email(p_token text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_s private.access_request_accm%rowtype;
  v_r public.access_requests%rowtype;
begin
  if v_uid is null or not private.accm_confirm_mail_live() or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return 'invalid';
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select * into v_s from private.access_request_accm where token_hash = v_hash for update;
  if v_s.request_id is null then
    return 'invalid';
  end if;
  select * into v_r from public.access_requests where id = v_s.request_id for update;
  if v_r.user_id is distinct from v_uid then
    return 'invalid';
  end if;
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
revoke all on function public.confirm_accm_email(text) from public, anon;
grant execute on function public.confirm_accm_email(text) to authenticated;

-- N2: also check the Academy email of requests still awaiting ACCM confirmation. The ACCM email counts only when
-- confirmed (accm_email_confirmed_at is not null), so an unconfirmed address is never checked or linked.
create or replace function private.match_access_requests()
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare
  r record;
  v_matched int := 0;
  v_pending int := 0;
begin
  for r in
    select q.id, q.user_id, q.status, q.accm_email_hash, q.accm_email_confirmed_at, q.created_at,
           (select a.role from private.member_allowlist a join auth.users u on u.id = q.user_id
             where u.email_confirmed_at is not null and a.email_hash = private.email_hash(u.email)) as academy_role,
           (select a.role from private.member_allowlist a
             where q.accm_email_confirmed_at is not null and a.email_hash = q.accm_email_hash) as accm_role,
           (select c.consented_at from private.member_join_consent c where c.user_id = q.user_id) as consent_at
      from public.access_requests q where q.status in ('pending', 'awaiting_email_confirm') for update of q
  loop
    if coalesce(r.academy_role, r.accm_role) is null then
      update public.access_requests set refresh_checks = refresh_checks + 1, last_checked_at = now() where id = r.id;
      v_pending := v_pending + 1;
    else
      update public.access_requests
         set status = 'matched', matched_via = case when r.academy_role is not null then 'academy' else 'accm' end,
             matched_at = now(), refresh_checks = refresh_checks + 1, last_checked_at = now()
       where id = r.id;
      -- An address that was never confirmed is not needed any more: drop the raw copy.
      delete from private.access_request_accm where request_id = r.id and accm_email is not null;
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
