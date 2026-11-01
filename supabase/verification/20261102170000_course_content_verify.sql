-- Verify 20261102170000_course_content.sql (read-only). Every row should have ok = true.
-- Banned-word regex skips Tagalog "garantisado": two quiz items ask "Garantisado ba...?" with "Hindi" as the answer (anti-guarantee teaching). compliance_check.py covers full text.
with c as (select id, slug from public.training_courses where slug in ('gold-reset','gold-strategy-basics','gold-advanced-setups')),
l as (select l.* from public.training_lessons l join public.training_modules m on m.id = l.module_id join c on c.id = m.course_id),
txt as (
  select title || ' ' || coalesce(tldr,'') || ' ' || coalesce(body_md,'') || ' ' || coalesce(takeaway,'') || ' ' || coalesce(practice_task,'') t from l
  union all select q.questions::text from private.training_quizzes q join l on l.id = q.lesson_id
  union all select p.questions::text || ' ' || coalesce(p.disclaimer,'') from private.placement_quizzes p join c on c.id = p.course_id
  union all select k.title || ' ' || k.rubric::text || ' ' || coalesce(k.disclaimer,'') from public.training_capstones k join c on c.id = k.course_id)
select 'lessons = 55' as check, (select count(*) from l) = 55 as ok, jsonb_build_object('n', (select count(*) from l)) as detail
union all select 'quiz questions = 169', (select sum(jsonb_array_length(q.questions)) from private.training_quizzes q join l on l.id = q.lesson_id) = 169,
  jsonb_build_object('n', (select sum(jsonb_array_length(q.questions)) from private.training_quizzes q join l on l.id = q.lesson_id))
union all select 'every quiz row has >= 1 question', not exists (select 1 from private.training_quizzes q join l on l.id = q.lesson_id where jsonb_array_length(q.questions) < 1), null
union all select 'placement exactly 10 (gold-advanced-setups)', (select jsonb_array_length(questions) from private.placement_quizzes p join c on c.id = p.course_id where c.slug = 'gold-advanced-setups') = 10, null
union all select 'capstones = 2', (select count(*) from public.training_capstones k join c on c.id = k.course_id) = 2, null
union all select 'disclaimers present (placement + 2 capstones)',
  (select count(*) from private.placement_quizzes p join c on c.id = p.course_id where p.disclaimer is not null)
  + (select count(*) from public.training_capstones k join c on c.id = k.course_id where k.disclaimer is not null) = 3, null
union all select 'no banned wording (income/profit/win-rate/guarantee/signals/VIP/PDE/free bot)',
  not exists (select 1 from txt where t ~* '\m(income|profits?|win[- ]?rate|guarantee[ds]?|signals?|vip|pde|free bot)\M'),
  (select jsonb_agg(substring(t from '(?i)\m(income|profits?|win[- ]?rate|guarantee[ds]?|signals?|vip|pde|free bot)\M')) from txt where t ~* '\m(income|profits?|win[- ]?rate|guarantee[ds]?|signals?|vip|pde|free bot)\M')
union all select 'no broker/commission wording (#54 rules)',
  not exists (select 1 from txt where t ~* '(any broker you choose|kahit anong broker|commission|komisyon|rebate|introducing broker)'), null;
