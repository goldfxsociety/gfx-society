-- Verify 20261018150000_reversal_signal_remaining.sql (read-only).

-- 1) Moving averages takeaway updated. Expect 1 row, ok = true.
select slug, (key_takeaways ->> 1 = 'RSI above 70 suggests overbought, below 30 suggests oversold — possible reversal sign lang, hindi automatic na buy o sell.') as ok
from public.lessons where id = 'a9ae37e8-7cb6-47cb-b040-4abc36835cd9';

-- 2) SMC distractor updated; correctIndex still 0. Expect 1 row, ok = true.
select slug, (interactive_config #>> '{scenarios,2,options,1}' = 'A guaranteed reversal sign'
   and interactive_config #>> '{scenarios,2,correctIndex}' = '0') as ok
from public.lessons where id = 'd2da2c70-cab0-4003-9027-1af90404be06';

-- 3) Diagnostic explanation updated; correct_index still 3. Expect 1 row, ok = true.
select question_key, (explanation = 'Above 70 suggests overbought — possible reversal sign, hindi automatic na sell.'
   and correct_index = 3) as ok
from public.diagnostic_questions where id = '0b32ba8e-bd0a-4beb-a80e-043d4600b83c';

-- 4) Old "reversal signal" gone from these three fields. Expect remaining = 0.
select
  ((select (key_takeaways::text ~* 'reversal signal')::int from public.lessons where id = 'a9ae37e8-7cb6-47cb-b040-4abc36835cd9')
 + (select (interactive_config::text ~* 'reversal signal')::int from public.lessons where id = 'd2da2c70-cab0-4003-9027-1af90404be06')
 + (select (explanation ~* 'reversal signal')::int from public.diagnostic_questions where id = '0b32ba8e-bd0a-4beb-a80e-043d4600b83c')
  ) as remaining_old;

-- 5) Nothing else in each field changed (restore the change on the STORED row → pre-migration md5).
--    Pre-migration md5s were taken from a read-only SELECT on today's live prod values:
--      ma key_takeaways  md5 = c4f1ac1e638e6317a8f72531b465be3d
--      smc interactive_config md5 = c7f829ff5c458e1c2a223b233d40f160
--      diag explanation  md5 = 2e89d028344aaf8decbeaaf07a43b1cf
--    Each check also requires the NEW value is present, so it fails if the migration
--    was not applied (unlike hashing a bare old-text literal, which always passes).
--    Expect all true.
select
  (select
      key_takeaways ->> 1 = 'RSI above 70 suggests overbought, below 30 suggests oversold — possible reversal sign lang, hindi automatic na buy o sell.'
      and md5(jsonb_set(key_takeaways, '{1}',
          to_jsonb('RSI above 70 suggests overbought, below 30 suggests oversold — neither is a guaranteed reversal signal.'::text), false)::text)
         = 'c4f1ac1e638e6317a8f72531b465be3d'
   from public.lessons where id = 'a9ae37e8-7cb6-47cb-b040-4abc36835cd9') as ma_restore_ok,
  (select
      interactive_config #>> '{scenarios,2,options,1}' = 'A guaranteed reversal sign'
      and md5(jsonb_set(interactive_config, '{scenarios,2,options,1}',
          to_jsonb('A guaranteed reversal signal'::text), false)::text)
         = 'c7f829ff5c458e1c2a223b233d40f160'
   from public.lessons where id = 'd2da2c70-cab0-4003-9027-1af90404be06') as smc_restore_ok,
  (select
      explanation = 'Above 70 suggests overbought — possible reversal sign, hindi automatic na sell.'
      and md5(replace(
            explanation,
            'Above 70 suggests overbought — possible reversal sign, hindi automatic na sell.',
            'Above 70 suggests overbought, but it''s never a guaranteed reversal signal on its own.'
          )) = '2e89d028344aaf8decbeaaf07a43b1cf'
   from public.diagnostic_questions where id = '0b32ba8e-bd0a-4beb-a80e-043d4600b83c') as diag_restore_ok;

-- 6) Overlap check: this migration must not have changed candlestick-patterns.
--    If #41 is not yet applied, pin-bar signal is still "Reversal Signal".
--    If #41 is applied, it is "Possible reversal sign". Either way, tips from #41
--    are independent. Expect 1 row (lesson exists); report signal for QA.
select slug, interactive_config #>> '{patterns,5,signal}' as pin_bar_signal
from public.lessons where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0';
