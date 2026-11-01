-- Slice 2: GFX Trading System courses + manual GCash payments (MIGRATION FILE ONLY; NOT APPLIED).
-- Gate dependency: everything in this file calls ONE function, public.is_member(), defined below as a thin
-- wrapper over the #52 gate (currently public.my_membership()). When #52's OTP redesign lands, only the body of
-- public.is_member() changes (e.g. to has_members_access()); nothing here reads claim tables or columns.
--
-- Naming: public.courses / public.lessons already exist (Academy, 20261010 snapshot), so this slice uses
-- training_courses / training_modules / training_lessons. Quiz answers live in private.training_quizzes
-- and are only reachable through RPCs (never sent to the client).
--
-- Security model (no service-role key in the app):
--  * Every table has RLS on; anon/authenticated get SELECT only where a policy allows it.
--  * All writes go through SECURITY DEFINER RPCs with search_path pinned.
--  * Admin = row in public.admins (Ben adds his user id via SQL editor at go-live).
--  * Storage: private buckets 'receipts' and 'payment-assets'; policies below. Bucket rows are created
--    by this migration only when it is applied (needs Ben's OK). Nothing is uploaded by this file.
-- Guarded and re-runnable.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- admins
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;   -- false for anon; used in RLS policies

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.my_membership() in ('active', 'grace');
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- ---------------------------------------------------------------- content
create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  level text not null check (level in ('L1', 'course')),
  summary text not null default '',
  price_php integer not null default 0 check (price_php >= 0),
  status text not null default 'draft' check (status in ('draft', 'open')),
  sales_open boolean not null default false,          -- Buy/pay step only when true AND price > 0
  prereq_course_id uuid references public.training_courses(id),  -- hard lock (B9): prereq complete OR placement passed
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not sales_open or (price_php > 0 and status = 'open'))
);
alter table public.training_courses enable row level security;
revoke all on public.training_courses from public, anon, authenticated;
grant select on public.training_courses to anon, authenticated;
drop policy if exists training_courses_read on public.training_courses;
create policy training_courses_read on public.training_courses for select to anon, authenticated
  using (status = 'open' or (auth.uid() is not null and public.is_admin()));

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.training_courses(id) on delete cascade,
  sort integer not null,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  learning_goal text not null default '',
  setup_rules jsonb,                                   -- {entry, invalidation, sl, target}
  practice_task text not null default '',
  unique (course_id, slug),
  unique (course_id, sort)
);
alter table public.training_modules enable row level security;
revoke all on public.training_modules from public, anon, authenticated;
grant select on public.training_modules to authenticated;

create table if not exists public.training_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules(id) on delete cascade,
  sort integer not null,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  tldr text not null default '',
  body_md text not null default '',
  takeaway text not null default '',
  practice_task text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  unique (module_id, slug),
  unique (module_id, sort)
);
alter table public.training_lessons enable row level security;
revoke all on public.training_lessons from public, anon, authenticated;
grant select on public.training_lessons to authenticated;

-- ---------------------------------------------------------------- purchases
create table if not exists public.course_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.training_courses(id) on delete restrict,
  price_php integer not null,                 -- course price at submit time
  amount_entered numeric(10, 2) not null check (amount_entered > 0 and amount_entered < 1000000),
  payment_code text not null,                 -- GFX-XXXX (stable per user+course) the payer puts in the GCash message
  gcash_ref text not null check (length(gcash_ref) between 1 and 40),   -- normalized (spaces/dashes stripped)
  receipt_path text,                          -- receipts/{user_id}/{upload_uuid}.{ext}; null after deletion
  receipt_sha256 text not null check (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  flags text[] not null default '{}',         -- amount_mismatch | duplicate_ref | duplicate_image | check_format
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  reject_reason text,
  receipt_deleted_at timestamptz,
  history jsonb not null default '[]',        -- prior rejected attempts (B4): reason, decided_at, ref, sha, flags
  check (status <> 'rejected' or length(trim(coalesce(reject_reason, ''))) >= 3),
  check ((status = 'pending') = (decided_at is null))
);
-- One row per (user, course): a re-upload after reject reuses the row and its payment_code (B4).
create unique index if not exists course_purchases_one_per_course on public.course_purchases (user_id, course_id);
create unique index if not exists course_purchases_ref_approved
  on public.course_purchases (gcash_ref) where status = 'approved';
create unique index if not exists course_purchases_sha_approved
  on public.course_purchases (receipt_sha256) where status = 'approved';
create index if not exists course_purchases_ref on public.course_purchases (gcash_ref);
create index if not exists course_purchases_sha on public.course_purchases (receipt_sha256);
create index if not exists course_purchases_pending on public.course_purchases (submitted_at) where status = 'pending';
alter table public.course_purchases enable row level security;
revoke all on public.course_purchases from public, anon, authenticated;
grant select on public.course_purchases to authenticated;
drop policy if exists course_purchases_read on public.course_purchases;
create policy course_purchases_read on public.course_purchases for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Access to a course's content: free course -> member; paid -> member + approved purchase.
create or replace function public.has_course_access(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and public.is_member() and exists (
    select 1 from public.training_courses c
    where c.id = p_course_id and c.status = 'open'
      and (c.price_php = 0 or exists (
        select 1 from public.course_purchases p
        where p.user_id = auth.uid() and p.course_id = c.id and p.status = 'approved')));
$$;

-- Paid access (ideas feed, chat in later slices): member + at least one approved purchase.
create or replace function public.has_paid_access()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and public.is_member() and exists (
    select 1 from public.course_purchases p where p.user_id = auth.uid() and p.status = 'approved');
$$;

-- has_course_access references course_purchases; (re)grant after both exist.
revoke all on function public.has_course_access(uuid) from public, anon;
grant execute on function public.has_course_access(uuid) to authenticated;
revoke all on function public.has_paid_access() from public, anon;
grant execute on function public.has_paid_access() to authenticated;

drop policy if exists training_modules_read on public.training_modules;
create policy training_modules_read on public.training_modules for select to authenticated
  using (public.has_course_access(course_id) or public.is_admin());
drop policy if exists training_lessons_read on public.training_lessons;
create policy training_lessons_read on public.training_lessons for select to authenticated
  using (public.is_admin() or (status = 'published' and exists (
    select 1 from public.training_modules m where m.id = module_id and public.has_course_access(m.course_id))));

-- ---------------------------------------------------------------- quizzes + progress
create table if not exists private.training_quizzes (
  lesson_id uuid primary key references public.training_lessons(id) on delete cascade,
  questions jsonb not null      -- [{q, options[], answer_index, explain}]
);
revoke all on private.training_quizzes from public, anon, authenticated;

create table if not exists public.training_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.training_lessons(id) on delete cascade,
  quiz_score integer,
  quiz_total integer,
  practice_done boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.training_progress enable row level security;
revoke all on public.training_progress from public, anon, authenticated;
grant select on public.training_progress to authenticated;
drop policy if exists training_progress_read on public.training_progress;
create policy training_progress_read on public.training_progress for select to authenticated
  using (user_id = auth.uid());

create or replace function private.lesson_access(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.training_lessons l join public.training_modules m on m.id = l.module_id
                 where l.id = p_lesson_id and l.status = 'published' and public.has_course_access(m.course_id));
$$;
revoke all on function private.lesson_access(uuid) from public, anon, authenticated;

-- Questions without answers.
create or replace function public.get_lesson_quiz(p_lesson_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not private.lesson_access(p_lesson_id) then return null; end if;
  return (select jsonb_agg(jsonb_build_object('q', e->'q', 'options', e->'options') order by i)
          from private.training_quizzes t, jsonb_array_elements(t.questions) with ordinality as x(e, i)
          where t.lesson_id = p_lesson_id);
end $$;
revoke all on function public.get_lesson_quiz(uuid) from public, anon;
grant execute on function public.get_lesson_quiz(uuid) to authenticated;

-- Scores server-side; returns {score,total,passed,explains[]}. Done = quiz >= 80% + practice ticked.
create or replace function public.submit_lesson_quiz(p_lesson_id uuid, p_answers integer[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_q jsonb; v_score int := 0; v_total int; v_ex jsonb := '[]';
begin
  if not private.lesson_access(p_lesson_id) then raise exception 'no access' using errcode = '42501'; end if;
  select questions into v_q from private.training_quizzes where lesson_id = p_lesson_id;
  if v_q is null then raise exception 'no quiz' using errcode = 'P0002'; end if;
  v_total := jsonb_array_length(v_q);
  for i in 0 .. v_total - 1 loop
    if p_answers is not null and array_length(p_answers, 1) > i and p_answers[i + 1] = (v_q->i->>'answer_index')::int then
      v_score := v_score + 1;
    end if;
    v_ex := v_ex || jsonb_build_array(v_q->i->'explain');
  end loop;
  insert into public.training_progress as tp (user_id, lesson_id, quiz_score, quiz_total)
  values (auth.uid(), p_lesson_id, v_score, v_total)
  on conflict (user_id, lesson_id) do update
    set quiz_score = greatest(coalesce(tp.quiz_score, 0), excluded.quiz_score), quiz_total = excluded.quiz_total,
        completed_at = case when tp.practice_done and greatest(coalesce(tp.quiz_score, 0), excluded.quiz_score) * 5 >= excluded.quiz_total * 4
                            then coalesce(tp.completed_at, now()) else tp.completed_at end,
        updated_at = now();
  return jsonb_build_object('score', v_score, 'total', v_total, 'passed', v_score * 5 >= v_total * 4, 'explains', v_ex);
end $$;
revoke all on function public.submit_lesson_quiz(uuid, integer[]) from public, anon;
grant execute on function public.submit_lesson_quiz(uuid, integer[]) to authenticated;

create or replace function public.set_practice_done(p_lesson_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not private.lesson_access(p_lesson_id) then raise exception 'no access' using errcode = '42501'; end if;
  insert into public.training_progress as tp (user_id, lesson_id, practice_done)
  values (auth.uid(), p_lesson_id, p_done)
  on conflict (user_id, lesson_id) do update set practice_done = excluded.practice_done, updated_at = now(),
    completed_at = case when excluded.practice_done and (tp.quiz_total is null or tp.quiz_score * 5 >= tp.quiz_total * 4)
                        then coalesce(tp.completed_at, now()) else null end;
  -- lessons without a quiz complete on practice alone
end $$;
revoke all on function public.set_practice_done(uuid, boolean) from public, anon;
grant execute on function public.set_practice_done(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- completion, capstone, placement, prereq
-- Capstone = self-check rubric only (B10): all items ticked = capstone done. No submission, no admin queue.
create table if not exists public.training_capstones (
  course_id uuid primary key references public.training_courses(id) on delete cascade,
  title text not null,
  rubric jsonb not null default '[]'          -- ["item text", ...]
);
alter table public.training_capstones enable row level security;
revoke all on public.training_capstones from public, anon, authenticated;
grant select on public.training_capstones to authenticated;
drop policy if exists training_capstones_read on public.training_capstones;
create policy training_capstones_read on public.training_capstones for select to authenticated
  using (public.has_course_access(course_id) or public.is_admin());

create table if not exists public.capstone_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.training_courses(id) on delete cascade,
  ticked integer[] not null default '{}',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table public.capstone_progress enable row level security;
revoke all on public.capstone_progress from public, anon, authenticated;
grant select on public.capstone_progress to authenticated;
drop policy if exists capstone_progress_read on public.capstone_progress;
create policy capstone_progress_read on public.capstone_progress for select to authenticated using (user_id = auth.uid());

create or replace function public.set_capstone_items(p_course_id uuid, p_ticked integer[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int; v_t int[];
begin
  if not public.has_course_access(p_course_id) then raise exception 'no access' using errcode = '42501'; end if;
  select jsonb_array_length(rubric) into v_n from public.training_capstones where course_id = p_course_id;
  if v_n is null then raise exception 'no capstone' using errcode = 'P0002'; end if;
  select coalesce(array_agg(distinct t order by t), '{}') into v_t from unnest(coalesce(p_ticked, '{}')) t where t between 0 and v_n - 1;
  insert into public.capstone_progress as cp (user_id, course_id, ticked, completed_at)
  values (auth.uid(), p_course_id, v_t, case when cardinality(v_t) = v_n then now() end)
  on conflict (user_id, course_id) do update set ticked = excluded.ticked, updated_at = now(),
    completed_at = case when cardinality(excluded.ticked) = v_n then coalesce(cp.completed_at, now()) end;
  return jsonb_build_object('ticked', to_jsonb(v_t), 'total', v_n, 'done', cardinality(v_t) = v_n);
end $$;
revoke all on function public.set_capstone_items(uuid, integer[]) from public, anon;
grant execute on function public.set_capstone_items(uuid, integer[]) to authenticated;

-- Course complete for the caller: >=1 lesson, every lesson completed, and capstone done if one exists.
create or replace function public.course_complete(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null
    and exists (select 1 from public.training_lessons l join public.training_modules m on m.id = l.module_id where m.course_id = p_course_id)
    and not exists (
      select 1 from public.training_lessons l join public.training_modules m on m.id = l.module_id
      left join public.training_progress tp on tp.lesson_id = l.id and tp.user_id = auth.uid()
      where m.course_id = p_course_id and tp.completed_at is null)
    and (not exists (select 1 from public.training_capstones where course_id = p_course_id)
         or exists (select 1 from public.capstone_progress where course_id = p_course_id and user_id = auth.uid() and completed_at is not null));
$$;
revoke all on function public.course_complete(uuid) from public, anon;
grant execute on function public.course_complete(uuid) to authenticated;

-- Placement quiz (B9): questions per course, answers private; pass >= 80%; retry after 24 h cooldown.
create table if not exists private.placement_quizzes (
  course_id uuid primary key references public.training_courses(id) on delete cascade,
  questions jsonb not null                    -- [{q, options[], answer_index, explain}]
);
revoke all on private.placement_quizzes from public, anon, authenticated;

create table if not exists public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.training_courses(id) on delete cascade,
  score integer not null,
  total integer not null,
  passed boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists placement_attempts_user on public.placement_attempts (user_id, course_id, attempted_at desc);
alter table public.placement_attempts enable row level security;
revoke all on public.placement_attempts from public, anon, authenticated;
grant select on public.placement_attempts to authenticated;
drop policy if exists placement_attempts_read on public.placement_attempts;
create policy placement_attempts_read on public.placement_attempts for select to authenticated using (user_id = auth.uid());

-- Prereq met for the caller (hard lock, B9): no prereq, OR prereq course complete, OR placement passed.
create or replace function public.prereq_met(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select c.prereq_course_id is null
                        or public.course_complete(c.prereq_course_id)
                        or exists (select 1 from public.placement_attempts a
                                   where a.user_id = auth.uid() and a.course_id = c.id and a.passed)
                   from public.training_courses c where c.id = p_course_id), false);
$$;
revoke all on function public.prereq_met(uuid) from public, anon;
grant execute on function public.prereq_met(uuid) to authenticated;

-- Redefine course access now that prereq_met exists: locked courses (B9) grant no lesson access even if paid.
create or replace function public.has_course_access(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and public.is_member() and public.prereq_met(p_course_id) and exists (
    select 1 from public.training_courses c
    where c.id = p_course_id and c.status = 'open'
      and (c.price_php = 0 or exists (
        select 1 from public.course_purchases p
        where p.user_id = auth.uid() and p.course_id = c.id and p.status = 'approved')));
$$;

create or replace function private.placement_next_at(p_user uuid, p_course uuid)
returns timestamptz language sql stable security definer set search_path = public, pg_temp as $$
  select case when exists (select 1 from public.placement_attempts where user_id = p_user and course_id = p_course and passed) then null
              else (select max(attempted_at) + interval '24 hours' from public.placement_attempts
                    where user_id = p_user and course_id = p_course and not passed) end;
$$;
revoke all on function private.placement_next_at(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_placement_quiz(p_course_slug text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.training_courses; v_next timestamptz;
begin
  if auth.uid() is null or not public.is_member() then return null; end if;
  select * into c from public.training_courses where slug = p_course_slug and prereq_course_id is not null;
  if c.id is null then return null; end if;
  v_next := private.placement_next_at(auth.uid(), c.id);
  return jsonb_build_object(
    'passed', exists (select 1 from public.placement_attempts where user_id = auth.uid() and course_id = c.id and passed),
    'next_attempt_at', case when v_next > now() then v_next end,
    'questions', (select jsonb_agg(jsonb_build_object('q', e->'q', 'options', e->'options') order by i)
                  from private.placement_quizzes t, jsonb_array_elements(t.questions) with ordinality as x(e, i)
                  where t.course_id = c.id));
end $$;
revoke all on function public.get_placement_quiz(text) from public, anon;
grant execute on function public.get_placement_quiz(text) to authenticated;

create or replace function public.submit_placement_quiz(p_course_slug text, p_answers integer[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.training_courses; v_q jsonb; v_score int := 0; v_total int; v_next timestamptz; v_pass boolean;
begin
  if auth.uid() is null or not public.is_member() then raise exception 'not a member' using errcode = '42501'; end if;
  select * into c from public.training_courses where slug = p_course_slug and prereq_course_id is not null;
  if c.id is null then raise exception 'no placement' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtext('placement:' || auth.uid()::text || c.id::text));
  if exists (select 1 from public.placement_attempts where user_id = auth.uid() and course_id = c.id and passed) then
    return jsonb_build_object('passed', true, 'already', true);
  end if;
  v_next := private.placement_next_at(auth.uid(), c.id);
  if v_next > now() then return jsonb_build_object('cooldown_until', v_next); end if;
  select questions into v_q from private.placement_quizzes where course_id = c.id;
  if v_q is null or jsonb_array_length(v_q) = 0 then raise exception 'no quiz content' using errcode = 'P0002'; end if;
  v_total := jsonb_array_length(v_q);
  for i in 0 .. v_total - 1 loop
    if p_answers is not null and coalesce(array_length(p_answers, 1), 0) > i and p_answers[i + 1] = (v_q->i->>'answer_index')::int then
      v_score := v_score + 1;
    end if;
  end loop;
  v_pass := v_score * 5 >= v_total * 4;
  insert into public.placement_attempts (user_id, course_id, score, total, passed) values (auth.uid(), c.id, v_score, v_total, v_pass);
  return jsonb_build_object('score', v_score, 'total', v_total, 'passed', v_pass,
                            'cooldown_until', case when not v_pass then now() + interval '24 hours' end);
end $$;
revoke all on function public.submit_placement_quiz(text, integer[]) from public, anon;
grant execute on function public.submit_placement_quiz(text, integer[]) to authenticated;

-- Content ready = >=1 lesson and no draft lessons (B11: otherwise "Coming soon", no Buy).
create or replace function public.course_content_ready(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.training_lessons l join public.training_modules m on m.id = l.module_id where m.course_id = p_course_id)
     and not exists (select 1 from public.training_lessons l join public.training_modules m on m.id = l.module_id
                     where m.course_id = p_course_id and l.status <> 'published');
$$;
revoke all on function public.course_content_ready(uuid) from public;
grant execute on function public.course_content_ready(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- payments
-- Stable per (user, course) code shown BEFORE paying, so the payer can put it in the GCash message.
create or replace function private.payment_code(p_user uuid, p_course uuid)
returns text language sql immutable set search_path = public, extensions, pg_temp as $$
  -- GFX- + 4 chars, no ambiguous 0/O/1/I. Not unique across users (32^4); admin matches code + email + ref.
  select 'GFX-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(d, i) % 32 + 1, 1), '' order by i)
  from (select extensions.digest(p_user::text || ':' || p_course::text || ':gfx-pay', 'sha256') as d) x,
       generate_series(0, 3) as i;
$$;
revoke all on function private.payment_code(uuid, uuid) from public, anon, authenticated;

-- GCash ref: strip spaces and dashes; 13 digits ("1234 567 890123") is the known format.
create or replace function public.normalize_gcash_ref(p text)
returns text language sql immutable set search_path = pg_temp as $$
  select regexp_replace(coalesce(p, ''), '[\s-]', '', 'g');
$$;
grant execute on function public.normalize_gcash_ref(text) to authenticated;

-- Pay-step state for the caller. state: not_member | not_found | coming_soon | locked | closed | pending | approved | open | rejected
create or replace function public.my_payment_info(p_course_slug text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.training_courses; p public.course_purchases; v_state text;
begin
  if auth.uid() is null or not public.is_member() then return jsonb_build_object('state', 'not_member'); end if;
  select * into c from public.training_courses where slug = p_course_slug and status = 'open';
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

-- Submit (or re-submit after reject: same row, same payment_code, B4) after the server action uploaded
-- the receipt to receipts/{uid}/{upload_uuid}.{ext}. Returns the old receipt path (if any) for deletion.
-- Flags are advisory only: they never block and never auto-decide.
create or replace function public.submit_course_purchase(
  p_course_slug text, p_amount_entered numeric, p_gcash_ref text, p_receipt_path text, p_receipt_sha256 text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.training_courses; v_uid uuid := auth.uid(); v_ref text; v_sha text := lower(p_receipt_sha256);
        v_flags text[] := '{}'; p public.course_purchases; v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not public.is_member() then raise exception 'not a member' using errcode = '42501'; end if;
  select * into c from public.training_courses where slug = p_course_slug and status = 'open' and sales_open and price_php > 0;
  if c.id is null or not public.course_content_ready(c.id) then raise exception 'course not for sale' using errcode = 'P0002'; end if;
  if not public.prereq_met(c.id) then raise exception 'prerequisite not met' using errcode = '42501'; end if;
  if p_receipt_path is null or p_receipt_path !~ ('^' || v_uid::text || '/[0-9a-f-]{36}\.(jpg|png|pdf)$') then
    raise exception 'bad receipt path' using errcode = '22023';
  end if;
  if v_sha is null or v_sha !~ '^[0-9a-f]{64}$' then raise exception 'bad receipt hash' using errcode = '22023'; end if;
  v_ref := public.normalize_gcash_ref(p_gcash_ref);
  if v_ref = '' or length(v_ref) > 40 then raise exception 'gcash ref required' using errcode = '22023'; end if;

  select * into p from public.course_purchases where user_id = v_uid and course_id = c.id for update;
  if p.status in ('pending', 'approved') then raise exception 'already pending or approved' using errcode = '23505'; end if;

  if p_amount_entered is distinct from c.price_php::numeric then v_flags := array_append(v_flags, 'amount_mismatch'); end if;
  if exists (select 1 from public.course_purchases where gcash_ref = v_ref and id is distinct from p.id) then
    v_flags := array_append(v_flags, 'duplicate_ref'); end if;
  if exists (select 1 from public.course_purchases where receipt_sha256 = v_sha and id is distinct from p.id) then
    v_flags := array_append(v_flags, 'duplicate_image'); end if;
  if v_ref !~ '^\d{13}$' then v_flags := array_append(v_flags, 'check_format'); end if;

  if p.id is null then
    insert into public.course_purchases (user_id, course_id, price_php, amount_entered, payment_code, gcash_ref,
                                         receipt_path, receipt_sha256, flags)
    values (v_uid, c.id, c.price_php, p_amount_entered, private.payment_code(v_uid, c.id), v_ref, p_receipt_path, v_sha, v_flags)
    returning id into v_id;
  else
    update public.course_purchases set
      history = history || jsonb_build_array(jsonb_build_object('status', status, 'reject_reason', reject_reason,
                  'submitted_at', submitted_at, 'decided_at', decided_at, 'gcash_ref', gcash_ref,
                  'receipt_sha256', receipt_sha256, 'amount_entered', amount_entered, 'flags', to_jsonb(flags))),
      status = 'pending', price_php = c.price_php, amount_entered = p_amount_entered, gcash_ref = v_ref,
      receipt_path = p_receipt_path, receipt_sha256 = v_sha, flags = v_flags, submitted_at = now(),
      decided_at = null, decided_by = null, reject_reason = null, receipt_deleted_at = null
    where id = p.id returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id, 'payment_code', private.payment_code(v_uid, c.id), 'flags', to_jsonb(v_flags),
                            'old_receipt_path', case when p.receipt_path is distinct from p_receipt_path then p.receipt_path end);
end $$;
revoke all on function public.submit_course_purchase(text, numeric, text, text, text) from public, anon;
grant execute on function public.submit_course_purchase(text, numeric, text, text, text) to authenticated;

-- Admin list with masked email (B8) and the other purchase codes behind duplicate flags.
create or replace function public.admin_list_purchases(p_status text)
returns table (id uuid, payment_code text, course_title text, price_php integer, amount_entered numeric,
               email_masked text, gcash_ref text, flags text[], dup_codes text[], receipt_path text,
               status text, submitted_at timestamptz, decided_at timestamptz, reject_reason text, history jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  select p.id, p.payment_code, c.title, p.price_php, p.amount_entered,
         case when u.email is null then null
              else left(split_part(u.email, '@', 1), 2) || '***@' || split_part(u.email, '@', 2) end,
         p.gcash_ref, p.flags,
         (select coalesce(array_agg(distinct o.payment_code), '{}') from public.course_purchases o
           where o.id <> p.id and (o.gcash_ref = p.gcash_ref or o.receipt_sha256 = p.receipt_sha256)),
         p.receipt_path, p.status, p.submitted_at, p.decided_at, p.reject_reason, p.history
  from public.course_purchases p
  join public.training_courses c on c.id = p.course_id
  left join auth.users u on u.id = p.user_id
  where (p_status = 'pending' and p.status = 'pending') or (p_status = 'history' and p.status <> 'pending')
  order by case when p_status = 'pending' then p.submitted_at end asc,
           case when p_status <> 'pending' then p.decided_at end desc
  limit 100;
end $$;
revoke all on function public.admin_list_purchases(text) from public, anon;
grant execute on function public.admin_list_purchases(text) to authenticated;

-- Admin decision. Returns the receipt path so the server action deletes the file, then calls
-- mark_receipt_deleted(). A failed delete leaves receipt_deleted_at null -> shown for retry.
create or replace function public.decide_course_purchase(p_id uuid, p_decision text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.course_purchases;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'bad decision' using errcode = '22023'; end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  select * into r from public.course_purchases where id = p_id for update;
  if r.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then raise exception 'already decided' using errcode = '55000'; end if;
  begin
    update public.course_purchases
       set status = p_decision, decided_at = now(), decided_by = auth.uid(),
           reject_reason = case when p_decision = 'rejected' then trim(p_reason) end
     where id = p_id;
  exception when unique_violation then
    raise exception 'same GCash ref or receipt already approved' using errcode = '23505';
  end;
  return jsonb_build_object('id', p_id, 'status', p_decision, 'receipt_path', r.receipt_path);
end $$;
revoke all on function public.decide_course_purchase(uuid, text, text) from public, anon;
grant execute on function public.decide_course_purchase(uuid, text, text) to authenticated;

create or replace function public.mark_receipt_deleted(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.course_purchases set receipt_path = null, receipt_deleted_at = now()
   where id = p_id and status <> 'pending';
end $$;
revoke all on function public.mark_receipt_deleted(uuid) from public, anon;
grant execute on function public.mark_receipt_deleted(uuid) to authenticated;

-- ---------------------------------------------------------------- pending summary (Jarvis poll)
-- Called by GET /api/admin/pending-summary with the anon key AFTER the route checked the bearer token
-- against env (constant time). The RPC re-checks sha256(token) against private.app_settings
-- ('payments_summary_token_sha256', set by Ben at go-live) and rate-limits globally, so the anon
-- grant leaks nothing without the token. Returns counts only.
create table if not exists private.api_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);
revoke all on private.api_rate_limits from public, anon, authenticated;

create or replace function public.pending_payments_summary(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v_hash text; v_win timestamptz := date_trunc('hour', now()); v_hits int;
begin
  insert into private.api_rate_limits as rl (bucket, window_start, hits) values ('pending_summary', v_win, 1)
  on conflict (bucket, window_start) do update set hits = rl.hits + 1 returning hits into v_hits;
  delete from private.api_rate_limits where window_start < now() - interval '1 day';
  if v_hits > 60 then return jsonb_build_object('error', 'rate_limited'); end if;
  select value into v_hash from private.app_settings where key = 'payments_summary_token_sha256';
  if v_hash is null or p_token is null
     or encode(extensions.digest(p_token, 'sha256'), 'hex') <> lower(v_hash) then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  return (select jsonb_build_object('pending_count', count(*), 'oldest_pending_at', min(submitted_at))
          from public.course_purchases where status = 'pending');
end $$;
revoke all on function public.pending_payments_summary(text) from public;
grant execute on function public.pending_payments_summary(text) to anon, authenticated;

-- ---------------------------------------------------------------- storage (private buckets)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']),
       ('payment-assets', 'payment-assets', false, 2097152, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

-- receipts: member uploads into (and may read) their own folder only; admin reads (signed URL 60 s) and
-- deletes; owner may delete only an orphan upload (no purchase row points at it), so a failed submit can clean up.
drop policy if exists receipts_insert_own on storage.objects;
create policy receipts_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
drop policy if exists receipts_select_admin on storage.objects;
create policy receipts_select_admin on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text));
drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (public.is_admin() or (
    (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.course_purchases p where p.receipt_path = name))));

-- payment-assets: QR readable (signed URL) by signed-in allowlisted members only; no client writes.
-- Ben uploads gcash-qr.png via the dashboard at go-live.
drop policy if exists payment_assets_select_member on storage.objects;
create policy payment_assets_select_member on storage.objects for select to authenticated
  using (bucket_id = 'payment-assets' and name = 'gcash-qr.png' and (public.is_member() or public.is_admin()));
