-- GFX Sprint 3: Explorer vs Linked tiers (/workspace/gfx/design/trading-system/explorer-linked-tiers-spec.md v1.1, §2.4,
-- §4). MIGRATION FILE ONLY; NOT APPLIED. Applying it to production needs QA PASS plus Jarvis's go (Ben's standing
-- authority). Apply AFTER 20261111130000_accm_confirm_mailer.sql (prod version 20261111073716). Re-runnable (idempotent).
-- Before / after: supabase/verification/20261115120000_explorer_linked_tiers_verify.sql.
-- Revert: supabase/scripts/20261115_explorer_linked_tiers/revert.sql.
--
-- What this changes
--  1. Gold Reset is free for consented Explorers (§6.2). public.has_course_access and public.my_payment_info now also
--     let a CONFIRMED, join-v2-CONSENTED signed-in user (Explorer) into Gold Reset only (slug 'gold-reset', price 0,
--     open). Gold Strategy Basics / Gold Advanced Setups keep the existing member + approved-purchase rule; the S8
--     delisted-owner path is unchanged. RLS policies are unchanged: they already call has_course_access, so lessons,
--     modules, quizzes, practice, progress and capstone follow automatically.
--  2. Anytime add-only import (§4.4): private.upsert_allowlist(rows, source_file, actor). Never deletes, never starts
--     grace. Restores (relists) graced/removed members only for emails in this file. Then match_access_requests() and
--     activation of consented users. Counts only.
--  3. private.import_allowlist(jsonb) (monthly full snapshot, 14-day grace) is NOT modified. It stays the only path
--     that downgrades. private.import_allowlist_full(rows, source_file, actor) is a thin wrapper that calls it as is,
--     then the same consented-user activation, and labels its audit row (§4.4 "call the same activation from the
--     monthly refresh"), without touching its delete / grace rules.
--  3b. Ambiguous emails (§4.3.4, amendment v1.2 incl. option A): an allowlisted email hash with more than one owner
--     (private.hash_owners) never links anyone in ANY import path (live import_allowlist, upsert, import_allowlist_full):
--     activate_consented_members() skips it, and private.match_access_requests() is REDEFINED (live 15 Nov body,
--     md5 252ce0b1..., plus the skip; same grants) so a pending request naming it stays pending. Counted in
--     `conflicts` (distinct hashes) in the return value, and in the audit row where the new code writes one (upsert,
--     full wrapper). Nothing user-facing changes: the user just sees the neutral pending copy.
--     Role (amendment v1.2 (5)): the upsert never changes an existing row's role (explicit or blank); new rows take
--     the row's role or 'client'. Only the monthly snapshot (import_allowlist) or an admin edit changes a role.
--  4. Audit log (§4.6): additive columns on private.allowlist_refresh_log. Existing writes keep working (defaults).
--  5. Request consent version: public.submit_access_request also accepts 'request-v2' (Privacy v1.6 consent text,
--     no cadence). 'request-v1' stays accepted and valid. One-line change; see the last section.
-- Not added: no new public table, no new grant to anon/authenticated (QA P2-SQL-2), no account ID / User ID column,
-- no plaintext email, no admin UI or endpoint. New functions live in schema private with all privileges revoked.
-- Email matching stays email-only: Academy email, or a CONFIRMED ACCM email on a matched request (private.member_hashes).

-- ---------------------------------------------------------------- audit log columns (additive)
alter table private.allowlist_refresh_log add column if not exists mode text not null default 'full'
  check (mode in ('upsert', 'full'));
alter table private.allowlist_refresh_log add column if not exists source_file text
  check (source_file is null or char_length(source_file) <= 200);
alter table private.allowlist_refresh_log add column if not exists actor text
  check (actor is null or char_length(actor) <= 64);
alter table private.allowlist_refresh_log add column if not exists updated int not null default 0;
alter table private.allowlist_refresh_log add column if not exists consented_activated int not null default 0;
alter table private.allowlist_refresh_log add column if not exists conflicts int not null default 0;
alter table private.allowlist_refresh_log add column if not exists skipped int not null default 0;
revoke all on private.allowlist_refresh_log from public, anon, authenticated;

-- ---------------------------------------------------------------- tier helpers (private, no grants)
-- Explorer course = free for a consented Explorer. Only Gold Reset (spec §6.2), and only while it is open and free.
create or replace function private.explorer_course(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.training_courses c
                  where c.id = p_course_id and c.slug = 'gold-reset' and c.price_php = 0 and c.status = 'open');
$$;
revoke all on function private.explorer_course(uuid) from public, anon, authenticated;

-- Confirmed Academy email + join-v2 consent on file (same consent test as public.my_join_state()).
create or replace function private.join_consented(p_uid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select p_uid is not null
     and exists (select 1 from auth.users u
                  where u.id = p_uid and u.email_confirmed_at is not null and coalesce(btrim(u.email), '') <> '')
     and (exists (select 1 from private.member_join_consent c where c.user_id = p_uid and c.consent_version = 'join-v2')
          or exists (select 1 from public.member_status m where m.user_id = p_uid and m.consent_version = 'join-v2'));
$$;
revoke all on function private.join_consented(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- course access (live body + one Explorer branch)
create or replace function public.has_course_access(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    private.owns_open_course(auth.uid(), p_course_id)
    or (public.is_member() and public.prereq_met(p_course_id) and exists (
      select 1 from public.training_courses c
      where c.id = p_course_id and c.status = 'open'
        and (c.price_php = 0 or exists (
          select 1 from public.course_purchases p
          where p.user_id = auth.uid() and p.course_id = c.id and p.status = 'approved'))))
    -- Sprint 3: Gold Reset (lessons + its videos) is free for a confirmed, join-v2-consented Explorer.
    or (private.explorer_course(p_course_id) and private.join_consented(auth.uid())));
$$;
revoke all on function public.has_course_access(uuid) from public, anon;
grant execute on function public.has_course_access(uuid) to authenticated;

-- Live body; the only change is the not_member test: a consented Explorer gets the normal state for Gold Reset
-- ('free'). Paid courses stay 'not_member' for Explorers (the app shows "Link", never Buy).
create or replace function public.my_payment_info(p_course_slug text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.training_courses; p public.course_purchases; v_state text;
begin
  if auth.uid() is null then return jsonb_build_object('state', 'not_member'); end if;
  select * into c from public.training_courses where slug = p_course_slug and status = 'open';
  -- S8: a delisted owner still sees 'approved' for a bought course; everything else needs membership.
  -- Sprint 3: a consented Explorer also gets Gold Reset.
  if not public.is_member() and not (c.id is not null and (private.owns_open_course(auth.uid(), c.id)
                                       or (private.explorer_course(c.id) and private.join_consented(auth.uid())))) then
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

-- ---------------------------------------------------------------- import flip (§2.1 / §4.4)
-- Who each email hash belongs to: confirmed Academy emails, plus confirmed ACCM emails on access requests. Hashes and
-- user ids only (never an email). Used by the activation and by the upsert conflict check.
create or replace function private.hash_owners()
returns table (email_hash text, user_id uuid) language sql stable security definer set search_path = private, public, pg_temp as $$
  select private.email_hash(u.email), u.id from auth.users u
   where u.email_confirmed_at is not null and coalesce(btrim(u.email), '') <> ''
  union
  select r.accm_email_hash, r.user_id from public.access_requests r
   where r.accm_email_confirmed_at is not null and r.accm_email_hash is not null;
$$;
revoke all on function private.hash_owners() from public, anon, authenticated;

-- Request matching (amendment v1.2, option A): the live 15 Nov body (md5 252ce0b1...) plus one rule. An email hash with
-- MORE THAN ONE owner (private.hash_owners) never links a request, in every import path: the live import_allowlist,
-- the upsert and import_allowlist_full all call this function. Such a request just stays pending (normal refresh
-- check, so the user sees the neutral pending copy; nothing user-facing reveals the conflict). The skipped hashes are
-- left in pg_temp._mar_conflicts and counted in the result as `conflicts` (distinct hashes; no hash leaves the DB).
-- A request can still link through its OTHER email when that one has a single owner. Same signature, security
-- definer, search_path and grants (none) as live. revert.sql restores the live body byte for byte.
create or replace function private.match_access_requests()
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare
  r record;
  v_matched int := 0;
  v_pending int := 0;
begin
  perform private.purge_stale_accm_emails();
  drop table if exists pg_temp._mar_multi, pg_temp._mar_conflicts;
  create temp table _mar_multi on commit drop as
    select o.email_hash from private.hash_owners() o group by o.email_hash having count(distinct o.user_id) > 1;
  create temp table _mar_conflicts (email_hash text primary key) on commit drop;
  for r in
    select q.id, q.user_id, q.status, q.accm_email_hash, q.accm_email_confirmed_at, q.created_at, h.academy_hash,
           (select a.role from private.member_allowlist a where a.email_hash = h.academy_hash) as academy_listed,
           (select a.role from private.member_allowlist a
             where q.accm_email_confirmed_at is not null and a.email_hash = q.accm_email_hash) as accm_listed,
           exists (select 1 from _mar_multi m where m.email_hash = h.academy_hash) as academy_multi,
           exists (select 1 from _mar_multi m where m.email_hash = q.accm_email_hash) as accm_multi,
           (select c.consented_at from private.member_join_consent c where c.user_id = q.user_id) as consent_at
      from public.access_requests q
      left join lateral (select private.email_hash(u.email) as academy_hash from auth.users u
                          where u.id = q.user_id and u.email_confirmed_at is not null) h on true
     where q.status in ('pending', 'awaiting_email_confirm') for update of q
  loop
    -- Count a skip only when it is real: the request would have matched, and stays pending only because of it.
    if coalesce(case when r.academy_multi then null else r.academy_listed end,
                case when r.accm_multi then null else r.accm_listed end) is null then
      if r.academy_listed is not null and r.academy_multi then
        insert into _mar_conflicts values (r.academy_hash) on conflict do nothing;
      end if;
      if r.accm_listed is not null and r.accm_multi then
        insert into _mar_conflicts values (r.accm_email_hash) on conflict do nothing;
      end if;
    end if;
    r.academy_listed := case when r.academy_multi then null else r.academy_listed end;
    r.accm_listed := case when r.accm_multi then null else r.accm_listed end;
    if coalesce(r.academy_listed, r.accm_listed) is null then
      update public.access_requests set refresh_checks = refresh_checks + 1, last_checked_at = now() where id = r.id;
      v_pending := v_pending + 1;
    else
      update public.access_requests
         set status = 'matched', matched_via = case when r.academy_listed is not null then 'academy' else 'accm' end,
             matched_at = now(), refresh_checks = refresh_checks + 1, last_checked_at = now()
       where id = r.id;
      -- An address that was never confirmed is not needed any more: drop the raw copy.
      delete from private.access_request_accm where request_id = r.id and accm_email is not null;
      insert into public.member_status (user_id, allowlist_status, role, member_verified_at, consent_at, consent_version, grace_until)
        values (r.user_id, 'active', case when 'ib' in (r.academy_listed, r.accm_listed) then 'ib' else 'client' end, now(),
                coalesce(r.consent_at, r.created_at), 'join-v2', null)
      on conflict (user_id) do update set allowlist_status = 'active', role = excluded.role, member_verified_at = now(),
          consent_at = coalesce(public.member_status.consent_at, excluded.consent_at),
          consent_version = coalesce(public.member_status.consent_version, excluded.consent_version), grace_until = null;
      v_matched := v_matched + 1;
    end if;
  end loop;
  return jsonb_build_object('requests_matched', v_matched, 'requests_pending', v_pending,
                            'conflicts', (select count(*)::int from _mar_conflicts));
end;
$$;
revoke all on function private.match_access_requests() from public, anon, authenticated;

-- Users with join-v2 consent on file, a confirmed email (member_hashes only returns confirmed ones) now on the
-- allowlist, and no active/grace row -> member_status 'active'. Never-consented Explorers are not linked; an
-- unconfirmed ACCM email never counts. Add-only: never touches active/grace rows. Returns how many were activated.
-- Spec §4.3.4 / amendment v1.2 (4): an allowlisted hash with MORE THAN ONE owner never links anyone, in every import
-- path (upsert and the monthly full snapshot). Those hashes are left in pg_temp._act_conflicts (blocked = a consented,
-- not-yet-linked owner was skipped because of it) so the caller counts them in `conflicts`. No hash leaves the DB.
create or replace function private.activate_consented_members()
returns int language plpgsql security definer set search_path = private, public, pg_temp as $$
declare v_n int;
begin
  drop table if exists pg_temp._act_conflicts;
  create temp table _act_conflicts on commit drop as
    select o.email_hash, false as blocked
      from private.hash_owners() o join private.member_allowlist a on a.email_hash = o.email_hash
     group by o.email_hash having count(distinct o.user_id) > 1;
  with cand as (
    select c.user_id, c.consented_at
      from private.member_join_consent c
     where c.consent_version = 'join-v2'
       and not exists (select 1 from public.member_status ms
                        where ms.user_id = c.user_id and ms.allowlist_status in ('active', 'grace'))
  )
  -- Real skips only: a candidate owns the hash and has no other (single-owner) listed hash to be linked through.
  update _act_conflicts x set blocked = true
   where exists (select 1 from cand
                  where x.email_hash in (select private.member_hashes(cand.user_id))
                    and not exists (select 1 from private.member_allowlist a
                                     where a.email_hash in (select private.member_hashes(cand.user_id))
                                       and a.email_hash not in (select y.email_hash from _act_conflicts y)));
  with cand as (
    select c.user_id, c.consented_at,
           (select a.role from private.member_allowlist a
             where a.email_hash in (select private.member_hashes(c.user_id))
               and a.email_hash not in (select x.email_hash from _act_conflicts x)
             order by (a.role = 'ib') desc limit 1) as role
      from private.member_join_consent c
     where c.consent_version = 'join-v2'
       and not exists (select 1 from public.member_status ms
                        where ms.user_id = c.user_id and ms.allowlist_status in ('active', 'grace'))
  ), done as (
    insert into public.member_status (user_id, allowlist_status, role, member_verified_at, consent_at, consent_version, grace_until)
      select user_id, 'active', role, now(), consented_at, 'join-v2', null from cand where role is not null
    on conflict (user_id) do update set allowlist_status = 'active', role = excluded.role, member_verified_at = now(),
        consent_at = coalesce(public.member_status.consent_at, excluded.consent_at),
        consent_version = coalesce(public.member_status.consent_version, excluded.consent_version), grace_until = null
    returning 1)
  select count(*) into v_n from done;
  return v_n;
end;
$$;
revoke all on function private.activate_consented_members() from public, anon, authenticated;

-- Filename only (no path, no control characters), max 200 chars; actor label max 64.
create or replace function private.clean_source_file(p text)
returns text language sql immutable set search_path = pg_catalog, pg_temp as $$
  select nullif(left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '^.*[/\\]', ''), '[[:cntrl:]]', '', 'g')), 200), '');
$$;
revoke all on function private.clean_source_file(text) from public, anon, authenticated;

create or replace function private.import_actor(p text)
returns text language sql stable security definer set search_path = pg_catalog, pg_temp as $$
  select coalesce(auth.uid()::text, nullif(left(btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', '', 'g')), 64), ''), 'sql-editor');
$$;
revoke all on function private.import_actor(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- anytime upsert (add only)
-- p_rows: JSON array of objects. Only "email" (required) and "role" ('ib' | 'client') are read; every other key
-- (account ID, name, balance, ...) is ignored and never stored. Missing email or an unknown role value -> skipped.
-- Role (spec A4 + amendment v1.2 (5)): the upsert NEVER changes the role of a hash that is already listed, whether
-- the row's role is explicit or blank (an 'ib' row stays 'ib' even if the file says 'client'). A NEW hash takes the
-- row's role, or 'client' when blank. Role changes come only from the monthly snapshot (import_allowlist) or an
-- admin edit. `updated` is therefore always 0 (kept for the log column); listed hashes count as `unchanged`. Conflicts (same email with both roles in this file, or an
-- email that belongs to more than one Academy user) are counted and NOT added, so nobody is auto-linked on an
-- ambiguous row. A multi-owner hash that is ALREADY listed (e.g. from the monthly file) is skipped by the activation
-- and counted here too.
-- Returns {added, updated, unchanged, requests_matched, requests_pending, consented_activated, conflicts, skipped,
-- relisted}. Never echoes emails or hashes. Service role / SQL editor only.
create or replace function private.upsert_allowlist(p_rows jsonb, p_source_file text default null, p_actor text default null)
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare
  v_total int; v_valid int; v_added int; v_updated int; v_unchanged int; v_conflicts int; v_relisted int;
  v_act int; v_req jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'upsert_allowlist: p_rows must be a JSON array' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_rows);

  drop table if exists pg_temp._up_raw, pg_temp._up_in, pg_temp._up_owner;
  create temp table _up_raw on commit drop as
    select private.email_hash(e->>'email') as email_hash, nullif(lower(btrim(coalesce(e->>'role', ''))), '') as role
      from jsonb_array_elements(p_rows) e
     where jsonb_typeof(e) = 'object' and coalesce(btrim(e->>'email'), '') <> '';
  delete from _up_raw where role is not null and role not in ('ib', 'client');
  select count(*) into v_valid from _up_raw;

  -- Who each hash belongs to (confirmed Academy emails + confirmed ACCM emails on requests). Hashes only.
  create temp table _up_owner on commit drop as select o.email_hash, o.user_id from private.hash_owners() o;

  -- role null = no row in this file gave a role for this hash. Two different roles for one hash = conflict.
  create temp table _up_in on commit drop as
    select email_hash, min(role) as role, count(distinct role) > 1 as conflict from _up_raw group by email_hash;
  update _up_in i set conflict = true
   where (select count(distinct o.user_id) from _up_owner o where o.email_hash = i.email_hash) > 1;

  select count(*) filter (where conflict),
         count(*) filter (where not conflict and a.email_hash is null),
         0,
         count(*) filter (where not conflict and a.email_hash is not null)
    into v_conflicts, v_added, v_updated, v_unchanged
    from _up_in i left join private.member_allowlist a using (email_hash);

  -- Existing hashes: seen again, role untouched. New hashes: the row's role, or 'client' when blank.
  update private.member_allowlist a set seen_at = now()
    from _up_in i where i.email_hash = a.email_hash and not i.conflict;
  insert into private.member_allowlist (email_hash, role)
    select email_hash, coalesce(role, 'client') from _up_in where not conflict
  on conflict (email_hash) do nothing;

  -- Restore (never downgrade): graced/removed members whose email is IN THIS FILE -> active again.
  with r as (
    update public.member_status ms set allowlist_status = 'active', grace_until = null
     where ms.allowlist_status in ('grace', 'removed')
       and exists (select 1 from _up_in i where not i.conflict and i.email_hash in (select private.member_hashes(ms.user_id)))
    returning 1)
  select count(*) into v_relisted from r;

  v_req := private.match_access_requests();
  v_act := private.activate_consented_members();
  -- conflicts = distinct hashes: ambiguous rows in this file (not added) + allowlisted multi-owner hashes that kept a
  -- consented user from being linked + multi-owner hashes that kept a pending request pending (_mar_conflicts).
  select count(*) into v_conflicts from (
    select email_hash from _up_in where conflict
    union
    select email_hash from _act_conflicts where blocked
    union
    select email_hash from _mar_conflicts) c;

  insert into private.allowlist_refresh_log
    (mode, source_file, actor, added, updated, unchanged, removed, requests_matched, requests_pending,
     consented_activated, conflicts, skipped)
  values ('upsert', private.clean_source_file(p_source_file), private.import_actor(p_actor), v_added, v_updated,
          v_unchanged, 0, (v_req->>'requests_matched')::int, (v_req->>'requests_pending')::int, v_act, v_conflicts,
          v_total - v_valid);
  return jsonb_build_object('added', v_added, 'updated', v_updated, 'unchanged', v_unchanged,
                            'consented_activated', v_act, 'conflicts', v_conflicts, 'skipped', v_total - v_valid,
                            'relisted', v_relisted) || (v_req - 'conflicts');
end;
$$;
revoke all on function private.upsert_allowlist(jsonb, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- monthly full snapshot (wrapper; rules unchanged)
-- Calls private.import_allowlist(p_rows) exactly as it is (delete missing hashes, 14-day grace, relist,
-- match_access_requests, its own log row), then the same consented-user activation, then labels that log row.
-- Only for the COMPLETE monthly export. Never feed it a mid-cycle or partial file; use upsert_allowlist for those.
create or replace function private.import_allowlist_full(p_rows jsonb, p_source_file text default null, p_actor text default null)
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare v jsonb; v_act int; v_conf int; v_log bigint;
begin
  v := private.import_allowlist(p_rows);
  v_act := private.activate_consented_members();
  -- The monthly file has no conflict check of its own: multi-owner hashes are skipped by the activation (§4.3.4).
  -- plus pending requests that the request matching (inside import_allowlist) kept pending for the same reason.
  select count(*) into v_conf from (
    select email_hash from _act_conflicts where blocked
    union
    select email_hash from _mar_conflicts) c;
  select max(id) into v_log from private.allowlist_refresh_log where run_at = now();
  update private.allowlist_refresh_log
     set mode = 'full', source_file = private.clean_source_file(p_source_file), actor = private.import_actor(p_actor),
         consented_activated = v_act, conflicts = v_conf
   where id = v_log;
  return v || jsonb_build_object('consented_activated', v_act, 'conflicts', v_conf);
end;
$$;
revoke all on function private.import_allowlist_full(jsonb, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- request consent version (Privacy v1.6)
-- 5. The access-request consent text drops the "monthly update" cadence (Privacy v1.6, explorer-linked-tiers-spec §3),
--    so the app now stores consent_version 'request-v2' for new requests. The data and the purpose are unchanged, so
--    'request-v1' rows stay valid (no re-consent) and 'request-v1' is still accepted (a page loaded before a deploy).
--    Live body of public.submit_access_request (20261111130000_accm_confirm_mailer.sql, prod md5
--    da445ef25e6a78018d00afb84dd1fe67) with ONE line changed: the consent-version check. Same grants as before.
--    Apply this migration BEFORE the PR #75 app deploys: until then the live function rejects 'request-v2'.
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
  if p_consent_version is null or p_consent_version not in ('request-v1', 'request-v2') then
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
