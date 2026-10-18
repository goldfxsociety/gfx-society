-- Remaining "reversal signal" → "possible reversal sign" (Design follow-up after #41).
-- Does NOT touch candlestick-patterns (that is PR #41 / 20261018140000).
--
-- 1) moving-averages-and-rsi key_takeaways[1]
--    "...neither is a guaranteed reversal signal."
--    -> "...possible reversal sign lang, hindi automatic na buy o sell."
-- 2) smart-money-concepts-intro interactive_config scenarios[2].options[1]
--    "A guaranteed reversal signal"
--    -> "A guaranteed reversal sign"
--    (incorrect distractor; correctIndex untouched)
-- 3) diagnostic technical_tools_rsi_overbought explanation
--    "Above 70 suggests overbought, but it's never a guaranteed reversal signal on its own."
--    -> "Above 70 suggests overbought — possible reversal sign, hindi automatic na sell."
--
-- Mid-sentence / mid-phrase uses lowercase "possible reversal sign".
-- No "trade in the direction of…" in these fields. Quiz/diagnostic correct answers untouched.
-- Guarded + idempotent: each UPDATE fingerprints the full current field. Re-running updates 0 rows.
begin;

-- 1) Moving averages / RSI key takeaway
update public.lessons
set key_takeaways = jsonb_set(
      key_takeaways,
      '{1}',
      to_jsonb('RSI above 70 suggests overbought, below 30 suggests oversold — possible reversal sign lang, hindi automatic na buy o sell.'::text),
      false),
    updated_at = now()
where id = 'a9ae37e8-7cb6-47cb-b040-4abc36835cd9'
  and slug = 'moving-averages-and-rsi'
  and md5(key_takeaways::text) = 'c4f1ac1e638e6317a8f72531b465be3d'
  and key_takeaways ->> 1 = 'RSI above 70 suggests overbought, below 30 suggests oversold — neither is a guaranteed reversal signal.';

-- 2) SMC intro quiz distractor (correctIndex stays 0)
update public.lessons
set interactive_config = jsonb_set(
      interactive_config,
      '{scenarios,2,options,1}',
      to_jsonb('A guaranteed reversal sign'::text),
      false),
    updated_at = now()
where id = 'd2da2c70-cab0-4003-9027-1af90404be06'
  and slug = 'smart-money-concepts-intro'
  and md5(interactive_config::text) = 'c7f829ff5c458e1c2a223b233d40f160'
  and interactive_config #>> '{scenarios,2,options,1}' = 'A guaranteed reversal signal'
  and interactive_config #>> '{scenarios,2,correctIndex}' = '0';

-- 3) Diagnostic RSI overbought explanation
update public.diagnostic_questions
set explanation = 'Above 70 suggests overbought — possible reversal sign, hindi automatic na sell.'
where id = '0b32ba8e-bd0a-4beb-a80e-043d4600b83c'
  and question_key = 'technical_tools_rsi_overbought'
  and md5(explanation) = '2e89d028344aaf8decbeaaf07a43b1cf'
  and explanation = 'Above 70 suggests overbought, but it''s never a guaranteed reversal signal on its own.'
  and correct_index = 3;

commit;
