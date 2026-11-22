-- UU partner cutover — lesson / course-content copy audit (read-only).
-- Spec: uu-partner-cutover-spec.md (22 Nov 2026).
--
-- Expect: 0 hit rows.
-- There is no apply, backup, or revert script. A previous read-only prod run
-- on 22 Nov 2026, 5:27 PM Asia/Manila, scanned the tables below and found
-- 0 matching rows. Re-run this file in the Supabase SQL editor anytime;
-- it writes nothing.
--
-- Terms (ILIKE, any of): discord.gg, AZb5Gk9xNP, GFX Society Discord,
-- PDE x GFX, PDE, sumali sa Discord, Discord community,
-- guided training para sa beginners.

-- Sanity: confirm the tables are visible (expected counts as of the 22 Nov 2026
-- audit: lessons 32, training_lessons 55, training_courses 3, training_modules 12,
-- courses 1, levels 6). Counts may grow later; a non-zero hit count is the fail.
select 'public.lessons' as src, count(*)::int as n from public.lessons
union all select 'public.training_lessons', count(*)::int from public.training_lessons
union all select 'public.training_courses', count(*)::int from public.training_courses
union all select 'public.training_modules', count(*)::int from public.training_modules
union all select 'public.courses', count(*)::int from public.courses
union all select 'public.levels', count(*)::int from public.levels
order by src;

-- Hits: expect 0 rows.
with terms as (
  select * from (values
    ('discord.gg'),
    ('AZb5Gk9xNP'),
    ('GFX Society Discord'),
    ('PDE x GFX'),
    ('PDE'),
    ('sumali sa Discord'),
    ('Discord community'),
    ('guided training para sa beginners')
  ) as t(term)
),
src as (
  select 'public.lessons'::text as src, id::text as id, slug, title,
    jsonb_build_object(
      'content', content,
      'title', title,
      'learning_objective', learning_objective,
      'key_takeaways', key_takeaways::text,
      'examples', examples::text
    ) as fields
  from public.lessons
  union all
  select 'public.training_lessons', id::text, slug, title,
    jsonb_build_object(
      'body_md', body_md,
      'title', title,
      'tldr', tldr,
      'takeaway', takeaway,
      'practice_task', practice_task
    )
  from public.training_lessons
  union all
  select 'public.training_courses', id::text, slug, title,
    jsonb_build_object('summary', summary, 'title', title)
  from public.training_courses
  union all
  select 'public.training_modules', id::text, slug, title,
    jsonb_build_object('learning_goal', learning_goal, 'title', title, 'practice_task', practice_task)
  from public.training_modules
  union all
  select 'public.courses', id::text, slug, title,
    jsonb_build_object('description', description, 'title', title)
  from public.courses
  union all
  select 'public.levels', id::text, slug, title,
    jsonb_build_object('description', description, 'title', title)
  from public.levels
),
hits as (
  select s.src, s.id, s.slug, s.title, t.term, f.key as field
  from src s
  cross join terms t
  cross join lateral jsonb_each_text(s.fields) f
  where f.value ilike '%' || t.term || '%'
)
select src, id, slug, title, field, array_agg(term order by term) as terms
from hits
group by src, id, slug, title, field
order by src, slug, field;
