-- QA L1: every published diagnostic question has correct_index = 0 (22/22,
-- 4 options each), so "always pick the first option" scored 42/44.
-- The app now shuffles options per session (src/lib/diagnostic/option-order.ts)
-- and still submits ORIGINAL indexes, so grading stays correct either way.
-- This migration is defence in depth: it rotates each question's stored
-- options so the correct answer sits at position k = row_number % n,
-- spreading correct answers evenly over A/B/C/D.
--
-- Idempotent: only touches rows whose correct_index is still 0 and whose
-- target position k is not 0; after one run those rows have
-- correct_index = k <> 0 and are skipped. Rows with k = 0 never change.
-- Explanations don't reference option letters (checked: 0 rows match).
--
-- Apply at a quiet time: a learner mid-diagnostic while this runs has the
-- old option array in their browser; any answers they submit after the
-- update would be graded against the new positions. Past answers keep their
-- stored `correct` flag and are not re-graded.
-- APPLIED on prod as version 20261010145817. NOT idempotent as first written:
-- a re-run re-ranked the 6 rows still at 0 and would move 4 of them. Now
-- guarded to run only while EVERY question is still at 0 (the original
-- state). Superseded by 20261011095000_diagnostic_rebalance_fixed_targets.sql.

with ranked as (
  select id,
         options,
         jsonb_array_length(options) as n,
         ((row_number() over (order by order_index, question_key) - 1)
           % jsonb_array_length(options))::int as k
  from diagnostic_questions
  where correct_index = 0
    and not exists (select 1 from diagnostic_questions x where x.correct_index <> 0)
    and jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) > 1
),
rotated as (
  select r.id,
         r.k,
         (
           -- new[j] = old[(j - k) mod n]  => old[0] (the correct one) lands at j = k
           select jsonb_agg(r.options -> (((j - r.k) % r.n + r.n) % r.n)::int order by j)
           from generate_series(0, r.n - 1) as j
         ) as new_options
  from ranked r
  where r.k <> 0
)
update diagnostic_questions q
set options = rotated.new_options,
    correct_index = rotated.k
from rotated
where q.id = rotated.id
  and q.correct_index = 0;

-- Verify (read-only):
-- select correct_index, count(*) from diagnostic_questions where is_published group by 1 order by 1;
--   expected after apply: 0 -> 6, 1 -> 6, 2 -> 5, 3 -> 5 (for 22 questions)
