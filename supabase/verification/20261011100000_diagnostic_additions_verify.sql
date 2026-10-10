-- Verify after applying the rebalance-fixed-targets and additions migrations (read-only).
-- Expected correct-option TEXT per question_key, generated read-only from live data
-- on 2026-10-10 (and from diagnostic-additions.json for the 8 new keys).
-- risk_management_risk_per_trade: '$10' after the 1% fix ('$10–$20' before it).

-- A) Every question's correct option text is unchanged. Expect 0 rows.
with expected(question_key, correct_text) as (
  values
    ('foundations_going_long', 'Going long (buy first, sell higher later)'),
    ('foundations_safe_haven', 'Investors often move money into Gold during fear or uncertainty, which tends to support its price'),
    ('foundations_spread_calculation', '30 pips'),
    ('platform_order_types', 'Limit order'),
    ('platform_demo_purpose', 'A demo account'),
    ('price_action_bullish_bearish', 'Bullish — close is above open'),
    ('price_action_doji', 'Indecision between buyers and sellers (Doji)'),
    ('price_action_patterns_not_guaranteed', 'No — it''s a clue, always wait for confirmation'),
    ('market_structure_uptrend', 'Uptrend (Higher Highs, Higher Lows)'),
    ('market_structure_support', 'Support'),
    ('market_structure_role_reversal', 'New support (role reversal)'),
    ('technical_tools_rsi_overbought', 'Possibly overbought — a potential (not guaranteed) pullback zone'),
    ('technical_tools_timeframes', 'The overall trend direction'),
    ('gold_session_volatility', 'The London–New York overlap, roughly 9 PM–12 AM'),
    ('setups_trading_plan_purpose', 'A trading plan'),
    ('setups_backtesting_purpose', 'Backtest it against historical price action'),
    ('risk_management_risk_per_trade', '$10'),
    ('risk_management_stop_loss', 'No — never trade without a stop loss, no exceptions'),
    ('risk_management_rr_win_rate', 'Likely profitable overall, even though it loses more often than it wins'),
    ('psychology_revenge_trading', 'Revenge trading'),
    ('psychology_fomo', 'FOMO (Fear Of Missing Out)'),
    ('journaling_reason_for_entry', 'No — the reason for entry matters, not just the result'),
    ('gold_micro_lot_move', '$3'),
    ('gold_news_release', 'Avoid opening new trades until the release has passed and spreads settle'),
    ('journaling_trade_record', 'Reason for entry, stop loss, position size, result, and whether you followed your plan'),
    ('journaling_weekly_review', 'How many trades followed every rule in your plan'),
    ('setups_lot_size_from_stop', '0.04 lot'),
    ('technical_tools_moving_average', 'The recent trend has generally been upward, though it can change at any time'),
    ('psychology_moving_stop', 'It increases your risk beyond what you planned'),
    ('platform_attach_stop_loss', 'When you place the order, as part of the order')
)
select e.question_key, e.correct_text as expected, q.options ->> q.correct_index as actual, q.correct_index
from expected e
left join diagnostic_questions q using (question_key)
where q.id is null
   or (q.options ->> q.correct_index) is distinct from e.correct_text
      and not (e.question_key = 'risk_management_risk_per_trade' and q.options ->> q.correct_index = '$10–$20');

-- B) Spread over the 22 originals (order_index 1-22). Expect 0:6, 1:6, 2:5, 3:5.
select correct_index, count(*) from diagnostic_questions
where order_index between 1 and 22 group by 1 order by 1;

-- C) Spread over all 30 published. Expect 0:8, 1:8, 2:7, 3:7.
select correct_index, count(*) from diagnostic_questions where is_published group by 1 order by 1;

-- D) Per area. Expect every area = 3 (30 total).
select competency_key, count(*) from diagnostic_questions where is_published group by 1 order by 1;

-- E) Option-set integrity: each question has 4 distinct options. Expect 0 rows.
select question_key from diagnostic_questions
where jsonb_typeof(options) <> 'array' or jsonb_array_length(options) <> 4
   or (select count(distinct e) from jsonb_array_elements(options) e) <> 4;
