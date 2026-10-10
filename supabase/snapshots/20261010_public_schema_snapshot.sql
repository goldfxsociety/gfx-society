-- ==========================================================
-- GFX Society: PUBLIC SCHEMA SNAPSHOT (reference only, DO NOT RUN as a migration)
-- Generated 2026-10-10 ~21:50 PHT from project hprbztlbvctlxmmnoigb via READ-ONLY
-- catalog queries (pg_catalog / pg_policies). Not a pg_dump: no data, no sequences
-- ownership, no comments. Use `supabase db dump --schema-only` for an authoritative dump.
-- ==========================================================

-- Extensions: plpgsql 1.0, pg_stat_statements 1.11, uuid-ossp 1.1, pgcrypto 1.3, supabase_vault 0.3.1

create table public.analytics_events (
  id uuid default gen_random_uuid() not null,
  user_id uuid default auth.uid(),
  event_name text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamp with time zone default now() not null,
  PRIMARY KEY (id) /*analytics_events_pkey*/,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE /*analytics_events_user_id_fkey*/
);
alter table public.analytics_events enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.assessment_attempts (
  id uuid default gen_random_uuid() not null,
  user_id uuid default auth.uid() not null,
  lesson_id uuid not null,
  score integer not null,
  total integer not null,
  passed boolean not null,
  attempt_number integer not null,
  created_at timestamp with time zone default now() not null,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE /*assessment_attempts_lesson_id_fkey*/,
  PRIMARY KEY (id) /*assessment_attempts_pkey*/,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE /*assessment_attempts_user_id_fkey*/
);
alter table public.assessment_attempts enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.courses (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  title text not null,
  description text,
  is_published boolean default false not null,
  order_index integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  PRIMARY KEY (id) /*courses_pkey*/,
  UNIQUE (slug) /*courses_slug_key*/
);
alter table public.courses enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.diagnostic_answers (
  id uuid default gen_random_uuid() not null,
  session_id uuid not null,
  user_id uuid default auth.uid() not null,
  question_id uuid not null,
  competency_key text not null,
  selected_index integer,
  correct boolean,
  answered_at timestamp with time zone default now() not null,
  PRIMARY KEY (id) /*diagnostic_answers_pkey*/,
  FOREIGN KEY (question_id) REFERENCES diagnostic_questions(id) /*diagnostic_answers_question_id_fkey*/,
  FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE /*diagnostic_answers_session_id_fkey*/,
  UNIQUE (session_id, question_id) /*diagnostic_answers_session_id_question_id_key*/,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE /*diagnostic_answers_user_id_fkey*/
);
alter table public.diagnostic_answers enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.diagnostic_questions (
  id uuid default gen_random_uuid() not null,
  question_key text not null,
  competency_key text not null,
  question text not null,
  options jsonb not null,
  correct_index integer not null,
  explanation text not null,
  chart jsonb,
  question_type text not null,
  difficulty text not null,
  order_index integer not null,
  is_published boolean default true not null,
  PRIMARY KEY (id) /*diagnostic_questions_pkey*/,
  UNIQUE (question_key) /*diagnostic_questions_question_key_key*/
);
alter table public.diagnostic_questions enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=awdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.diagnostic_sessions (
  id uuid default gen_random_uuid() not null,
  user_id uuid default auth.uid() not null,
  status text default 'in_progress'::text not null,
  started_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  competency_scores jsonb,
  recommended_level_id uuid,
  recommended_lesson_id uuid,
  PRIMARY KEY (id) /*diagnostic_sessions_pkey*/,
  FOREIGN KEY (recommended_lesson_id) REFERENCES lessons(id) /*diagnostic_sessions_recommended_lesson_id_fkey*/,
  FOREIGN KEY (recommended_level_id) REFERENCES levels(id) /*diagnostic_sessions_recommended_level_id_fkey*/,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE /*diagnostic_sessions_user_id_fkey*/
);
alter table public.diagnostic_sessions enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.lesson_progress (
  id uuid default gen_random_uuid() not null,
  user_id uuid default auth.uid() not null,
  lesson_id uuid not null,
  completed_at timestamp with time zone default now() not null,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE /*lesson_progress_lesson_id_fkey*/,
  PRIMARY KEY (id) /*lesson_progress_pkey*/,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE /*lesson_progress_user_id_fkey*/,
  UNIQUE (user_id, lesson_id) /*lesson_progress_user_id_lesson_id_key*/
);
alter table public.lesson_progress enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.lessons (
  id uuid default gen_random_uuid() not null,
  level_id uuid not null,
  slug text not null,
  title text not null,
  learning_objective text,
  content text not null,
  examples jsonb default '[]'::jsonb not null,
  key_takeaways jsonb default '[]'::jsonb not null,
  lesson_type text default 'reading'::text not null,
  interactive_config jsonb,
  order_index integer default 0 not null,
  estimated_minutes integer,
  is_published boolean default false not null,
  legacy_id text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  competency_key text,
  prerequisite_lesson_id uuid,
  passing_score integer,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE /*lessons_level_id_fkey*/,
  UNIQUE (level_id, slug) /*lessons_level_id_slug_key*/,
  PRIMARY KEY (id) /*lessons_pkey*/,
  FOREIGN KEY (prerequisite_lesson_id) REFERENCES lessons(id) /*lessons_prerequisite_lesson_id_fkey*/
);
alter table public.lessons enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.levels (
  id uuid default gen_random_uuid() not null,
  course_id uuid not null,
  slug text not null,
  title text not null,
  description text,
  order_index integer default 0 not null,
  badge_name text,
  badge_icon text,
  is_published boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE /*levels_course_id_fkey*/,
  UNIQUE (course_id, slug) /*levels_course_id_slug_key*/,
  PRIMARY KEY (id) /*levels_pkey*/
);
alter table public.levels enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.profiles (
  id uuid not null,
  display_name text,
  certificate_name text,
  avatar_url text,
  role text default 'student'::text not null,
  referred_by_code text,
  legacy_claimed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE /*profiles_id_fkey*/,
  PRIMARY KEY (id) /*profiles_pkey*/,
  CHECK ((role = ANY (ARRAY['student'::text, 'admin'::text]))) /*profiles_role_check*/
);
alter table public.profiles enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

create table public.resources (
  id uuid default gen_random_uuid() not null,
  title text not null,
  description text,
  category text not null,
  url text not null,
  icon text,
  order_index integer default 0 not null,
  is_published boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  PRIMARY KEY (id) /*resources_pkey*/
);
alter table public.resources enable row level security;
-- grants (acl): {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

-- ---------------- Policies ----------------
create policy "users can insert own events" on public.analytics_events as permissive for insert to public with check ((auth.uid() = user_id));
create policy "users can insert own attempts" on public.assessment_attempts as permissive for insert to public with check ((auth.uid() = user_id));
create policy "users can view own attempts" on public.assessment_attempts as permissive for select to public using ((auth.uid() = user_id));
create policy "Published courses are public" on public.courses as permissive for select to public using ((is_published = true));
create policy "users can view own diagnostic answers" on public.diagnostic_answers as permissive for select to public using ((auth.uid() = user_id));
create policy "anyone can read published diagnostic questions" on public.diagnostic_questions as permissive for select to public using ((is_published = true));
create policy "users can insert own diagnostic sessions" on public.diagnostic_sessions as permissive for insert to public with check ((auth.uid() = user_id));
create policy "users can update own diagnostic sessions" on public.diagnostic_sessions as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "users can view own diagnostic sessions" on public.diagnostic_sessions as permissive for select to public using ((auth.uid() = user_id));
create policy "Users can mark their own lessons complete" on public.lesson_progress as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can remove their own progress" on public.lesson_progress as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can view their own progress" on public.lesson_progress as permissive for select to public using ((auth.uid() = user_id));
create policy "users can update own lesson_progress" on public.lesson_progress as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Published lessons are public" on public.lessons as permissive for select to public using ((is_published = true));
create policy "Published levels are public" on public.levels as permissive for select to public using ((is_published = true));
create policy "Users can update their own profile" on public.profiles as permissive for update to public using ((auth.uid() = id));
create policy "Users can view their own profile" on public.profiles as permissive for select to public using ((auth.uid() = id));
create policy "Published resources are public" on public.resources as permissive for select to public using ((is_published = true));

-- ---------------- Functions ----------------
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.skip_diagnostic_question(p_session_id uuid, p_question_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_competency text;
begin
  if not exists (
    select 1 from diagnostic_sessions
    where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'not your session';
  end if;

  select competency_key into v_competency
    from diagnostic_questions
    where id = p_question_id and is_published = true;

  if v_competency is null then
    raise exception 'question not found or not published';
  end if;

  insert into diagnostic_answers (session_id, question_id, competency_key, selected_index, correct)
  values (p_session_id, p_question_id, v_competency, null, null)
  on conflict (session_id, question_id)
  do update set selected_index = null, correct = null, answered_at = now();

  insert into analytics_events (event_name, entity_id, metadata, user_id)
  values (
    'diagnostic_question_answered',
    p_question_id,
    jsonb_build_object('competency_key', v_competency, 'correct', null, 'skipped', true),
    auth.uid()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_diagnostic_results(p_session_id uuid)
 RETURNS TABLE(question_id uuid, question text, options jsonb, selected_index integer, correct boolean, correct_index integer, explanation text, competency_key text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    q.id,
    q.question,
    q.options,
    a.selected_index,
    a.correct,
    q.correct_index,
    q.explanation,
    q.competency_key
  from diagnostic_answers a
  join diagnostic_questions q on q.id = a.question_id
  join diagnostic_sessions s on s.id = a.session_id
  where a.session_id = p_session_id
    and s.user_id = auth.uid()
    and s.status = 'completed';
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_diagnostic_answer(p_session_id uuid, p_question_id uuid, p_selected_index integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_correct_index integer;
  v_competency text;
  v_is_correct boolean;
begin
  -- Ownership check: this is the entire defense against one user
  -- submitting into another user's session.
  if not exists (
    select 1 from diagnostic_sessions
    where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'not your session';
  end if;

  select correct_index, competency_key
    into v_correct_index, v_competency
    from diagnostic_questions
    where id = p_question_id and is_published = true;

  if v_correct_index is null then
    raise exception 'question not found or not published';
  end if;

  v_is_correct := (p_selected_index = v_correct_index);

  insert into diagnostic_answers (session_id, question_id, competency_key, selected_index, correct)
  values (p_session_id, p_question_id, v_competency, p_selected_index, v_is_correct)
  on conflict (session_id, question_id)
  do update set selected_index = excluded.selected_index,
                correct = excluded.correct,
                answered_at = now();

  insert into analytics_events (event_name, entity_id, metadata, user_id)
  values (
    'diagnostic_question_answered',
    p_question_id,
    jsonb_build_object('competency_key', v_competency, 'correct', v_is_correct, 'skipped', false),
    auth.uid()
  );

  return v_is_correct;
end;
$function$;

-- ---------------- Triggers ----------------
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------- Event triggers ----------------
-- event trigger issue_graphql_placeholder on sql_drop -> set_graphql_placeholder tags=['DROP EXTENSION']
-- event trigger pgrst_ddl_watch on ddl_command_end -> pgrst_ddl_watch tags=None
-- event trigger pgrst_drop_watch on sql_drop -> pgrst_drop_watch tags=None
-- event trigger issue_pg_cron_access on ddl_command_end -> grant_pg_cron_access tags=['CREATE EXTENSION']
-- event trigger issue_pg_net_access on ddl_command_end -> grant_pg_net_access tags=['CREATE EXTENSION']
-- event trigger issue_pg_graphql_access on ddl_command_end -> grant_pg_graphql_access tags=['CREATE EXTENSION']
-- event trigger ensure_rls on ddl_command_end -> rls_auto_enable tags=['CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO']
