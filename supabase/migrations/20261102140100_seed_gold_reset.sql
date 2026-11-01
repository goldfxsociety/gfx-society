-- Seed: Gold Reset (free L1) + paid course shells (MIGRATION FILE ONLY; NOT APPLIED).
-- Source: gold-courses-outline-2026-11-02.md (plan only). Lesson text is not final, so every lesson is
-- status 'draft' (invisible to members) until the full Taglish body is written and compliance-checked.
-- Paid courses stay status 'draft' + sales_open false: hidden, no pay step, until content is ready.
-- Quizzes are a content task (not seeded). Re-runnable: upserts on slug.

insert into public.training_courses (slug, title, level, summary, price_php, status, sales_open, sort) values
  ('gold-reset', 'Gold Reset', 'L1',
   $t$Para sa mga dating trader na gustong bumalik nang may disiplina, hindi para "bawiin" ang talo. 4 short lessons + Reset Checklist. Max 1% risk per trade.$t$,
   0, 'open', false, 1),
  ('gold-strategy-basics', 'Gold Strategy Basics', 'course',
   $t$Basahin ang Gold chart gamit ang H4/H1, mag-mark ng zones, at mag-plan ng trade na may SL, target at 1% risk bago pumasok.$t$,
   2000, 'draft', false, 2),
  ('gold-advanced-setups', 'Gold Advanced Setups', 'course',
   $t$Session-based setups (ORB, Asian range, liquidity sweep) at news discipline, gamit ang parehong Shared Rules.$t$,
   2000, 'draft', false, 3)
on conflict (slug) do update set title = excluded.title, level = excluded.level, summary = excluded.summary,
  price_php = excluded.price_php, sort = excluded.sort, updated_at = now();
-- status / sales_open are NOT overwritten on re-run, so a course opened later stays open.

insert into public.training_modules (course_id, sort, slug, title, learning_goal, practice_task)
select c.id, 1, 'gold-reset', 'Gold Reset',
       $t$Bumalik sa trading nang may rules: max 1% risk, journal, at cents account muna bago mas malaking pera.$t$,
       $t$Pirmahan ang sariling Reset Checklist; 2 linggong cents na sumusunod dito.$t$
from public.training_courses c where c.slug = 'gold-reset'
on conflict (course_id, slug) do update set title = excluded.title, learning_goal = excluded.learning_goal,
  practice_task = excluded.practice_task;

insert into public.training_lessons (module_id, sort, slug, title, tldr, practice_task, status)
select m.id, v.sort, v.slug, v.title, v.tldr, v.practice, 'draft'
from public.training_modules m
join public.training_courses c on c.id = m.course_id and c.slug = 'gold-reset'
cross join (values
  (1, 'why-accounts-blow-up', 'Why Accounts Blow Up',
   $t$Overleverage, revenge trading, walang SL, walang plan. Walang judgment, common ito.$t$,
   $t$Isulat ang 3 dahilan ng huling talo mo.$t$),
  (2, 'the-1-percent-rule', 'The 1% Rule',
   $t$Bakit max 1% risk; lot size formula; ilang sunod-sunod na talo ang kayang tiisin ng 1% vs 10%.$t$,
   $t$Compute ang lot size sa 3 sample SL distances.$t$),
  (3, 'journaling-that-works', 'Journaling That Works',
   $t$Simple template: date, session, setup, entry/SL/TP, R result, emosyon, lesson.$t$,
   $t$Mag-journal ng 5 cents o chart-replay trades.$t$),
  (4, 'restarting-on-cents', 'Restarting on Cents with Discipline',
   $t$Cents account na may maliit na perang kaya mong mawala, max 1% risk, rules muna bago pera.$t$,
   $t$2 linggong cents na sumusunod sa Reset Checklist.$t$),
  (5, 'reset-checklist', 'Reset Checklist',
   $t$Max trades/day, daily loss stop, walang trading sa news blackout. Pirmahan mo ang sarili mong checklist.$t$,
   $t$I-tick at i-date ang checklist mo.$t$)
) as v(sort, slug, title, tldr, practice)
where m.slug = 'gold-reset'
on conflict (module_id, slug) do update set title = excluded.title, tldr = excluded.tldr,
  practice_task = excluded.practice_task, sort = excluded.sort;
-- status is NOT overwritten on re-run (a lesson published later stays published).

-- B9: Gold Advanced Setups is hard-locked behind Gold Strategy Basics (or the placement quiz).
-- Placement questions are content (B11): Jarvis drafts, Ben approves; none seeded here.
update public.training_courses a set prereq_course_id = b.id
from public.training_courses b
where a.slug = 'gold-advanced-setups' and b.slug = 'gold-strategy-basics' and a.prereq_course_id is null;
