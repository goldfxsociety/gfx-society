-- Risk-Reward Ratio lesson: neutral, non-promissory wording (like the demo lesson fix).
-- Live text checked read-only on 2026-10-11 (interactive_config is {} -> no quiz text).
-- Same math (1:2 RR, 40% win rate, 4 x $20 - 6 x $10 = +$20) and the 1% rule.
-- Idempotent: each replace only runs while the old phrase is still present.
-- Sorts after the latest recorded version (20261010153837). NOT APPLIED.

update lessons
set content = replace(replace(content,
      '1:2 RR means risk $10 to make $20.',
      '1:2 RR means risking $10 (1% of a $1,000 account) for a $20 target.'),
      'Net = +$20 — profitable!',
      'Net = +$20 over these 10 trades. That is a positive expectancy over many trades, not a guarantee: a 40% win rate may still work with a favourable R:R if you keep following your plan (1% risk, stop-loss on every trade).'),
    updated_at = now()
where slug = 'risk-reward-ratio'
  and (content like '%— profitable!%' or content like '%risk $10 to make $20.%');

update lessons
set key_takeaways = replace(key_takeaways::text,
      'A strategy''s profitability depends on win rate AND risk-reward together — neither alone tells the full story.',
      'Whether a strategy has a positive expectancy depends on win rate AND risk-reward together — neither alone tells the full story, and results are never guaranteed.')::jsonb,
    updated_at = now()
where slug = 'risk-reward-ratio'
  and key_takeaways::text like '%A strategy''s profitability depends%';

update lessons
set learning_objective = replace(learning_objective,
      'determine whether a trading strategy is actually profitable.',
      'shape a strategy''s expectancy over many trades (never guaranteed).'),
    updated_at = now()
where slug = 'risk-reward-ratio'
  and learning_objective like '%actually profitable.%';
