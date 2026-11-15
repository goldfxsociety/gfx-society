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
--  4. Audit log (§4.6): additive columns on private.allowlist_refresh_log. Existing writes keep working (defaults).
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
-- Users with join-v2 consent on file, a confirmed email (member_hashes only returns confirmed ones) now on the
-- allowlist, and no active/grace row -> member_status 'active'. Never-consented Explorers are not linked; an
-- unconfirmed ACCM email never counts. Add-only: never touches active/grace rows. Returns how many were activated.
create or replace function private.activate_consented_members()
returns int language plpgsql security definer set search_path = private, public, pg_temp as $$
declare v_n int;
begin
  with cand as (
    select c.user_id, c.consented_at,
           (select a.role from private.member_allowlist a
             where a.email_hash in (select private.member_hashes(c.user_id))
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
-- p_rows: JSON array of objects. Only "email" (required) and "role" ('ib' | 'client'; missing/blank -> 'client') are
-- read; every other key (account ID, name, balance, ...) is ignored and never stored. Missing email or an unknown role
-- -> counted as skipped. Conflicts (same email with both roles in this file, or an email that belongs to more than
-- one Academy user) are counted and NOT added, so nobody is auto-linked on an ambiguous row.
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
    select private.email_hash(e->>'email') as email_hash, coalesce(nullif(lower(btrim(e->>'role')), ''), 'client') as role
      from jsonb_array_elements(p_rows) e
     where jsonb_typeof(e) = 'object' and coalesce(btrim(e->>'email'), '') <> '';
  delete from _up_raw where role not in ('ib', 'client');
  select count(*) into v_valid from _up_raw;

  -- Who each hash belongs to (confirmed Academy emails + confirmed ACCM emails on requests). Hashes only.
  create temp table _up_owner on commit drop as
    select private.email_hash(u.email) as email_hash, u.id as user_id from auth.users u
     where u.email_confirmed_at is not null and coalesce(btrim(u.email), '') <> ''
    union
    select r.accm_email_hash, r.user_id from public.access_requests r
     where r.accm_email_confirmed_at is not null and r.accm_email_hash is not null;

  create temp table _up_in on commit drop as
    select email_hash, min(role) as role, count(distinct role) > 1 as conflict from _up_raw group by email_hash;
  update _up_in i set conflict = true
   where (select count(distinct o.user_id) from _up_owner o where o.email_hash = i.email_hash) > 1;

  select count(*) filter (where conflict),
         count(*) filter (where not conflict and a.email_hash is null),
         count(*) filter (where not conflict and a.email_hash is not null and a.role <> i.role),
         count(*) filter (where not conflict and a.email_hash is not null and a.role = i.role)
    into v_conflicts, v_added, v_updated, v_unchanged
    from _up_in i left join private.member_allowlist a using (email_hash);

  insert into private.member_allowlist (email_hash, role)
    select email_hash, role from _up_in where not conflict
  on conflict (email_hash) do update set role = excluded.role, seen_at = now();

  -- Restore (never downgrade): graced/removed members whose email is IN THIS FILE -> active again.
  with r as (
    update public.member_status ms set allowlist_status = 'active', grace_until = null
     where ms.allowlist_status in ('grace', 'removed')
       and exists (select 1 from _up_in i where not i.conflict and i.email_hash in (select private.member_hashes(ms.user_id)))
    returning 1)
  select count(*) into v_relisted from r;

  v_req := private.match_access_requests();
  v_act := private.activate_consented_members();

  insert into private.allowlist_refresh_log
    (mode, source_file, actor, added, updated, unchanged, removed, requests_matched, requests_pending,
     consented_activated, conflicts, skipped)
  values ('upsert', private.clean_source_file(p_source_file), private.import_actor(p_actor), v_added, v_updated,
          v_unchanged, 0, (v_req->>'requests_matched')::int, (v_req->>'requests_pending')::int, v_act, v_conflicts,
          v_total - v_valid);
  return jsonb_build_object('added', v_added, 'updated', v_updated, 'unchanged', v_unchanged,
                            'consented_activated', v_act, 'conflicts', v_conflicts, 'skipped', v_total - v_valid,
                            'relisted', v_relisted) || v_req;
end;
$$;
revoke all on function private.upsert_allowlist(jsonb, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- monthly full snapshot (wrapper; rules unchanged)
-- Calls private.import_allowlist(p_rows) exactly as it is (delete missing hashes, 14-day grace, relist,
-- match_access_requests, its own log row), then the same consented-user activation, then labels that log row.
-- Only for the COMPLETE monthly export. Never feed it a mid-cycle or partial file; use upsert_allowlist for those.
create or replace function private.import_allowlist_full(p_rows jsonb, p_source_file text default null, p_actor text default null)
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $$
declare v jsonb; v_act int; v_log bigint;
begin
  v := private.import_allowlist(p_rows);
  v_act := private.activate_consented_members();
  select max(id) into v_log from private.allowlist_refresh_log where run_at = now();
  update private.allowlist_refresh_log
     set mode = 'full', source_file = private.clean_source_file(p_source_file), actor = private.import_actor(p_actor),
         consented_activated = v_act
   where id = v_log;
  return v || jsonb_build_object('consented_activated', v_act);
end;
$$;
revoke all on function private.import_allowlist_full(jsonb, text, text) from public, anon, authenticated;
