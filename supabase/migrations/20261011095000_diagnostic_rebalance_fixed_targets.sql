-- Corrective, re-run-safe answer-position rebalance (replaces the logic of
-- 20261011090000_diagnostic_rebalance_correct_index.sql, applied as 20261010145817).
--
-- Why: the earlier migration chose each row's target as row_number() % 4 over
-- the rows that STILL had correct_index = 0. That set shrinks once it has run,
-- so a re-run re-ranks the remaining six "A" rows and moves 4 of them again.
-- It was not idempotent. (Its first apply did work: live now shows 6/6/5/5.)
--
-- This version uses a FIXED target per question_key (embedded below):
--   * 22 originals: position (order_index - 1) % 4  ->  A/B/C/D = 6/6/5/5
--   * 8 additions (#14): the position authored in diagnostic-additions.json
--     (2 each)  ->  30 total = 8/8/7/7
-- Each row with correct_index <> target has its options rotated so the
-- correct option lands on target, and correct_index is set in the same UPDATE.
-- The correct option TEXT never changes (see the verify file).
-- Re-runs, and rows already at target, are no-ops. Keys that don't exist yet
-- are skipped, so it is safe before or after the additions migration.
-- Robust to shape: only rows whose options are a JSON array with more than
-- target entries and a valid correct_index.
-- NOT APPLIED.

with target(question_key, pos) as (
  values
    ('foundations_going_long', 0),
    ('foundations_safe_haven', 1),
    ('foundations_spread_calculation', 2),
    ('platform_order_types', 3),
    ('platform_demo_purpose', 0),
    ('price_action_bullish_bearish', 1),
    ('price_action_doji', 2),
    ('price_action_patterns_not_guaranteed', 3),
    ('market_structure_uptrend', 0),
    ('market_structure_support', 1),
    ('market_structure_role_reversal', 2),
    ('technical_tools_rsi_overbought', 3),
    ('technical_tools_timeframes', 0),
    ('gold_session_volatility', 1),
    ('setups_trading_plan_purpose', 2),
    ('setups_backtesting_purpose', 3),
    ('risk_management_risk_per_trade', 0),
    ('risk_management_stop_loss', 1),
    ('risk_management_rr_win_rate', 2),
    ('psychology_revenge_trading', 3),
    ('psychology_fomo', 0),
    ('journaling_reason_for_entry', 1),
    ('gold_micro_lot_move', 1),
    ('gold_news_release', 2),
    ('journaling_trade_record', 3),
    ('journaling_weekly_review', 0),
    ('setups_lot_size_from_stop', 1),
    ('technical_tools_moving_average', 3),
    ('psychology_moving_stop', 2),
    ('platform_attach_stop_loss', 0)
),
plan as (
  select q.id,
         t.pos,
         q.correct_index as cur,
         q.options,
         jsonb_array_length(q.options) as n
  from diagnostic_questions q
  join target t using (question_key)
  where jsonb_typeof(q.options) = 'array'
    and t.pos < jsonb_array_length(q.options)
    and q.correct_index between 0 and jsonb_array_length(q.options) - 1
    and q.correct_index <> t.pos
),
moved as (
  select p.id,
         p.pos,
         p.cur,
         -- new[j] = old[(j - (pos - cur)) mod n]  => old[cur] lands at j = pos
         (select jsonb_agg(p.options -> ((((j - (p.pos - p.cur)) % p.n) + p.n) % p.n) order by j)
            from generate_series(0, p.n - 1) as j) as new_options
  from plan p
)
update diagnostic_questions q
set options = m.new_options,
    correct_index = m.pos
from moved m
where q.id = m.id
  and q.correct_index = m.cur;   -- concurrency guard: row unchanged since planning
