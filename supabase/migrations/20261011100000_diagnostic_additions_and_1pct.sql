-- Diagnostic additions (QA L5): 8 questions from
-- /workspace/gfx/academy-content/diagnostic-additions.json (GFX Growth draft),
-- published, order_index 23-30. Plus the 1% fix on risk_management_risk_per_trade.
--
-- Ordering: runs after 20261011090000_diagnostic_rebalance_correct_index.sql
-- (#13), and is safe in either order:
--  * these rows already have spread correct_index (0,0,1,1,2,2,3,3), and the
--    rebalance only rotates options and correct_index together, so the answer
--    stays correct if the rebalance runs after this.
--  * the risk fix is plain text replacement inside question, options and
--    explanation, so it is independent of option order.
-- Idempotent: ON CONFLICT on the unique question_key (constraint
-- diagnostic_questions_question_key_key, checked read-only); the risk fix only
-- touches the row while it still contains the old text.
-- NOT APPLIED.

insert into diagnostic_questions
  (question_key, competency_key, question, options, correct_index, explanation,
   chart, question_type, difficulty, order_index, is_published)
values
  ('gold_micro_lot_move', 'gold',
   'Hypothetically, you hold 0.01 lot of Gold (XAUUSD) and the price moves $3.00 against you. Using the common convention (1 lot = 100 oz, so 0.01 lot = 1 oz), roughly how much is the loss before costs?',
   '["$0.03", "$3", "$30", "$300"]'::jsonb, 1,
   '0.01 lot = 1 oz, so a $3.00 move = $3. On 1 standard lot (100 oz) it would be $300. Contract sizes can vary by broker, so always check your platform''s specifications.',
   null, 'calculation', 'beginner', 23, true),
  ('gold_news_release', 'gold',
   'A major US economic report is due in 5 minutes and Gold is already moving fast. As a beginner practicing on demo, what is the most sensible approach?',
   '["Open a large trade before the release to catch the move", "Remove your stop loss so the spike doesn''t close your trade", "Avoid opening new trades until the release has passed and spreads settle", "Double your usual risk because volatility means opportunity"]'::jsonb, 2,
   'Around major news, Gold can spike and spreads can widen sharply. Beginners are safer waiting; risk stays at max 1% with a stop loss on every trade.',
   null, 'scenario', 'beginner', 24, true),
  ('journaling_trade_record', 'journaling',
   'Which entry belongs in a useful trading journal?',
   '["Only the profit or loss amount", "Only the trades that won", "Screenshots of other people''s results", "Reason for entry, stop loss, position size, result, and whether you followed your plan"]'::jsonb, 3,
   'A journal is for reviewing your process. Recording the reason, stop, size, outcome and rule-following lets you find and fix repeated mistakes.',
   null, 'mcq', 'beginner', 25, true),
  ('journaling_weekly_review', 'journaling',
   'At the end of a demo week you review your journal. Which measure best shows whether you are improving as a beginner?',
   '["How many trades followed every rule in your plan", "Your demo balance compared with last week", "How many trades you opened", "Your single biggest winning trade"]'::jsonb, 0,
   'Single results are partly luck. Rule-following (stop loss on every trade, max 1% risk, plan followed) is under your control and shows real progress.',
   null, 'scenario', 'intermediate', 26, true),
  ('setups_lot_size_from_stop', 'setups',
   'Hypothetically, your demo account is $1,000 and you risk max 1% per trade. Your planned Gold stop distance is $2.50. With 0.01 lot = 1 oz (a $0.01 move = $1 per standard lot), what lot size fits the rule?',
   '["0.01 lot", "0.04 lot", "0.40 lot", "4 lots"]'::jsonb, 1,
   '1% of $1,000 = $10. A $2.50 stop on 0.01 lot (1 oz) risks $2.50, so $10 ÷ $2.50 = 4 → 0.04 lot. Check: 4 oz × $2.50 = $10.',
   null, 'calculation', 'intermediate', 27, true),
  ('technical_tools_moving_average', 'technical_tools',
   'Gold is trading above a rising 50-period moving average. What does this generally suggest?',
   '["A guaranteed buy signal", "The spread is low", "You can skip your stop loss", "The recent trend has generally been upward, though it can change at any time"]'::jsonb, 3,
   'A moving average smooths past prices and helps describe trend direction. It is a lagging tool, not a guarantee, so trades still need a plan and a stop loss.',
   null, 'mcq', 'beginner', 28, true),
  ('psychology_moving_stop', 'psychology',
   'Your demo trade is moving toward your stop loss, so you move the stop further away to ''give it more room''. What is the main problem?',
   '["Nothing, it''s a normal adjustment", "It reduces your risk", "It increases your risk beyond what you planned", "It guarantees the trade will recover"]'::jsonb, 2,
   'Moving a stop further away means a bigger possible loss than your plan allowed. Many traders only move stops in the direction that reduces risk.',
   null, 'scenario', 'beginner', 29, true),
  ('platform_attach_stop_loss', 'platform',
   'When should you set the stop loss on a new trade?',
   '["When you place the order, as part of the order", "Only after the trade starts losing", "At the end of the day", "Only on live accounts, not on demo"]'::jsonb, 0,
   'Attach the stop loss when you place the order so the trade is protected from the first second, and practice it on demo every time to build the habit.',
   null, 'scenario', 'beginner', 30, true)
on conflict (question_key) do nothing;

-- risk_management_risk_per_trade: '1-2% rule' -> 1%, '$10-$20' -> $10
-- (live text uses an en dash; hyphen variant covered too).
update diagnostic_questions
set question = replace(replace(question, '1–2%', '1%'), '1-2%', '1%'),
    options = replace(replace(options::text, '$10–$20', '$10'), '$10-$20', '$10')::jsonb,
    explanation = replace(replace(replace(replace(explanation,
                    '1–2% of $1,000 is $10–$20.', '1% of $1,000 is $10.'),
                    '1-2% of $1,000 is $10-$20.', '1% of $1,000 is $10.'),
                    '1–2%', '1%'), '$10–$20', '$10')
where question_key = 'risk_management_risk_per_trade'
  and (question ~ '1[–-]2%' or options::text ~ '\$10[–-]\$20' or explanation ~ '1[–-]2%|\$10[–-]\$20');
