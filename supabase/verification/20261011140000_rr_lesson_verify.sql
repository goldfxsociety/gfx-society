-- Verify 20261011140000_rr_lesson_neutral_wording.sql (read-only).
-- 1) Expect profitable_hits = 0 and profit_hits = 0 for the lesson (all text fields).
select slug,
  (select count(*) from regexp_matches(coalesce(content,'') || ' ' || key_takeaways::text || ' ' ||
     coalesce(interactive_config::text,'') || ' ' || coalesce(learning_objective,''), 'profitab', 'gi')) as profitable_hits,
  (select count(*) from regexp_matches(coalesce(content,'') || ' ' || key_takeaways::text || ' ' ||
     coalesce(interactive_config::text,'') || ' ' || coalesce(learning_objective,''), 'profit', 'gi')) as profit_hits
from lessons where slug = 'risk-reward-ratio';

-- 2) Text otherwise intact. Expect every check = true.
select
  content like 'RR compares how much you risk vs how much you aim to make.%'          as intro_kept,
  content like '%With 1:2 RR and 40\% win rate:%4 wins x $20 = $80%6 losses x $10 = $60%Net = +$20 over these 10 trades.%' as math_kept,
  content like '%1\% of a $1,000 account%' and content like '%1\% risk, stop-loss on every trade%' as one_pct_rule,
  jsonb_array_length(key_takeaways) = 2                                               as two_takeaways,
  key_takeaways->>0 = 'Risk-Reward Ratio compares how much you risk to how much you aim to gain.' as takeaway1_unchanged,
  interactive_config = '{}'::jsonb                                                    as config_unchanged,
  lesson_type = 'risk_reward_calculator' and is_published                             as type_and_published
from lessons where slug = 'risk-reward-ratio';
