-- Neutral, non-promissory wording in 3 published lessons (follow-up to #17):
-- backtesting-your-strategy, demo-vs-live-account, smart-money-concepts-intro.
-- Texts taken read-only from live on 2026-10-11. Only exact strings are replaced.
-- Quiz option ORDER and correctIndex are untouched, and each option keeps its
-- meaning (correct options stay correct, distractors stay wrong).
-- Idempotent: each UPDATE runs only while an old phrase is still present.
-- Sorts after the latest recorded version (20261010153837) and after #17's file. NOT APPLIED.

update lessons
set interactive_config = replace(replace(interactive_config::text, 'Demo accounts are always more profitable', 'Demo accounts always produce better results'), 'Does being profitable on demo guarantee you''ll be profitable live?', 'Do positive results on demo guarantee the same results live?')::jsonb,
    updated_at = now()
where slug = 'demo-vs-live-account'
  and (interactive_config::text like '%Demo accounts are always more profitable%' or interactive_config::text like '%Does being profitable on demo guarantee you''ll be profitable live?%');

update lessons
set interactive_config = replace(replace(replace(replace(interactive_config::text, 'Net = +26R — solidly profitable, even under 50% win rate.', 'Net = +26R over those 100 test trades: a positive expectancy even under a 50% win rate, but not a guarantee of future results. Practise it on demo with 1% risk before going live.'), 'Test if your rules would have been profitable on historical data, without risking real money', 'Test whether your rules showed an edge on historical data, without risking real money'), 'Is this worth trading live?', 'What does this backtest suggest?'), 'Yes — the expectancy is positive', 'A positive expectancy in the test — worth practising on demo next (not guaranteed live)')::jsonb,
    updated_at = now()
where slug = 'backtesting-your-strategy'
  and (interactive_config::text like '%Net = +26R — solidly profitable, even under 50\% win rate.%' or interactive_config::text like '%Test if your rules would have been profitable on historical data, without risking real money%' or interactive_config::text like '%Is this worth trading live?%' or interactive_config::text like '%Yes — the expectancy is positive%');

update lessons
set interactive_config = replace(interactive_config::text, 'Any trader who is currently profitable', 'Any trader who is currently doing well')::jsonb,
    updated_at = now()
where slug = 'smart-money-concepts-intro'
  and (interactive_config::text like '%Any trader who is currently profitable%');

update lessons
set key_takeaways = replace(key_takeaways::text,
      'Being profitable on demo does not guarantee being profitable live.',
      'Positive results on demo don''t guarantee the same results live.')::jsonb,
    learning_objective = replace(learning_objective,
      'why demo profitability does not guarantee live profitability.',
      'why positive results on demo don''t guarantee the same results live.'),
    updated_at = now()
where slug = 'demo-vs-live-account'
  and (key_takeaways::text like '%Being profitable on demo%' or learning_objective like '%demo profitability%');
