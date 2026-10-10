-- Verification for 20261011100000_diagnostic_additions_and_1pct.sql (read-only).
-- 1) per-area counts (expect every area >= 3)
select competency_key, count(*) from diagnostic_questions where is_published group by 1 order by 2, 1;
-- 2) the 8 new rows, with the correct option text
select order_index, question_key, competency_key, correct_index, options ->> correct_index as correct_option
from diagnostic_questions where order_index between 23 and 30 order by order_index;
-- 3) answer-position spread (no single dominant position)
select correct_index, count(*) from diagnostic_questions where is_published group by 1 order by 1;
-- 4) risk row: expect 0 rows still mentioning 1-2% or $10-$20
select question_key, question, options, explanation from diagnostic_questions
where question_key = 'risk_management_risk_per_trade'
  and (question ~ '1[–-]2%' or options::text ~ '\$10[–-]\$20' or explanation ~ '1[–-]2%|\$10[–-]\$20');
-- 5) risk row current text
select question, options, correct_index, options ->> correct_index as correct_option, explanation
from diagnostic_questions where question_key = 'risk_management_risk_per_trade';
