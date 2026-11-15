-- Explorer vs Linked tiers: REVERT of supabase/migrations/20261115120000_explorer_linked_tiers.sql (only if needed;
-- needs Jarvis's go like the apply). One transaction. Re-runnable: a second run changes nothing.
--  * public.submit_access_request goes back to accepting 'request-v1' only (live body, md5 da445ef2...).
--    Existing 'request-v2' rows stay as they are. Revert the app first.
--  * public.has_course_access and public.my_payment_info go back to the exact live 15 Nov 2026 bodies (copied verbatim
--    from 20261102140000_courses_payments.sql; md5 5c19835b884faeb0743116d75cb287a9 / 96bbcf2c9095dd4fb99aa6016a2c2081,
--    checked by the verify file's 'revert:' rows). Same grants as before (authenticated only).
--  * Drops the 8 new private functions. Explorers lose Gold Reset again (their progress rows stay, unreadable via RLS).
--  * Drops the 7 audit columns added to private.allowlist_refresh_log (counts/labels of upsert runs are lost; the
--    original columns and rows stay). private.member_allowlist rows added by upserts STAY (that is member data, not
--    schema); the next monthly import_allowlist run reconciles them as usual.
--  * Members linked by private.activate_consented_members() (member_status rows set 'active') STAY active: the
--    revert only restores schema and function bodies, it never undoes data. Remove one by hand only if needed.
--  * private.match_access_requests() goes back to the exact live 15 Nov 2026 body (copied verbatim from
--    20261111130000_accm_confirm_mailer.sql; md5 252ce0b1289b29c27ef329532e95c9cf, checked by a 'revert:' row), so a
--    pending request naming a multi-owner email can match again. Same grants as before (none).
--  * private.import_allowlist(jsonb) was never changed, so nothing to restore.
-- Afterwards run supabase/verification/20261115120000_explorer_linked_tiers_verify.sql: the 5 always rows ('pre:',
-- 'unchanged:', no prefix) and the 4 'revert:' rows are true (9 rows); every 'apply:' row is false.
begin;

create or replace function public.has_course_access(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    private.owns_open_course(auth.uid(), p_course_id)
    or (public.is_member() and public.prereq_met(p_course_id) and exists (
      select 1 from public.training_courses c
      where c.id = p_course_id and c.status = 'open'
        and (c.price_php = 0 or exists (
          select 1 from public.course_purchases p
          where p.user_id = auth.uid() and p.course_id = c.id and p.status = 'approved')))));
$$;
revoke all on function public.has_course_access(uuid) from public, anon;
grant execute on function public.has_course_access(uuid) to authenticated;

create or replace function public.my_payment_info(p_course_slug text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.training_courses; p public.course_purchases; v_state text;
begin
  if auth.uid() is null then return jsonb_build_object('state', 'not_member'); end if;
  select * into c from public.training_courses where slug = p_course_slug and status = 'open';
  -- S8: a delisted owner still sees 'approved' for a bought course; everything else needs membership.
  if not public.is_member() and not (c.id is not null and private.owns_open_course(auth.uid(), c.id)) then
    return jsonb_build_object('state', 'not_member');
  end if;
  if c.id is null then return jsonb_build_object('state', 'not_found'); end if;
  select * into p from public.course_purchases where user_id = auth.uid() and course_id = c.id;
  v_state := case
    when p.status = 'approved' then 'approved'
    when p.status = 'pending' then 'pending'
    when c.price_php = 0 then 'free'
    when not public.course_content_ready(c.id) then 'coming_soon'
    when not public.prereq_met(c.id) then 'locked'
    when not c.sales_open then 'closed'
    when p.status = 'rejected' then 'rejected'
    else 'open' end;
  return jsonb_build_object('state', v_state, 'course_id', c.id, 'price_php', c.price_php,
    'payment_code', private.payment_code(auth.uid(), c.id), 'purchase_id', p.id,
    'reject_reason', p.reject_reason, 'submitted_at', p.submitted_at);
end $$;
revoke all on function public.my_payment_info(text) from public, anon;
grant execute on function public.my_payment_info(text) to authenticated;

-- Back to the live 15 Nov body (verbatim from 20261111130000_accm_confirm_mailer.sql, md5 da445ef25e6a78018d00afb84dd1fe67):
-- accepts 'request-v1' only. Revert the PR #75 app first (it sends 'request-v2'), or request submits fail.
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
    -- Q5: plain addr-spec only (same rule as ACCM_EMAIL_RE in src/lib/members/access-request.ts).
    if char_length(v_accm) > 254 or v_accm !~ '^[a-z0-9._%+-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
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
  perform private.purge_stale_accm_emails();

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

-- Live 15 Nov 2026 body, byte for byte (20261111130000_accm_confirm_mailer.sql).
create or replace function private.match_access_requests()
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare
  r record;
  v_matched int := 0;
  v_pending int := 0;
begin
  perform private.purge_stale_accm_emails();
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

drop function if exists private.import_allowlist_full(jsonb, text, text);
drop function if exists private.upsert_allowlist(jsonb, text, text);
drop function if exists private.activate_consented_members();
drop function if exists private.hash_owners();
drop function if exists private.import_actor(text);
drop function if exists private.clean_source_file(text);
drop function if exists private.join_consented(uuid);
drop function if exists private.explorer_course(uuid);

alter table private.allowlist_refresh_log drop column if exists mode;
alter table private.allowlist_refresh_log drop column if exists source_file;
alter table private.allowlist_refresh_log drop column if exists actor;
alter table private.allowlist_refresh_log drop column if exists updated;
alter table private.allowlist_refresh_log drop column if exists consented_activated;
alter table private.allowlist_refresh_log drop column if exists conflicts;
alter table private.allowlist_refresh_log drop column if exists skipped;

commit;
