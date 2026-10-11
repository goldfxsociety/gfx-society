-- Verify 20261011150000_neutral_profit_wording_3_lessons.sql (read-only).

-- 1) Expect profit_hits = 0 for all 3 lessons (content, takeaways, quiz, objective, title).
select slug,
  (select count(*) from regexp_matches(coalesce(content,'') || ' ' || key_takeaways::text || ' ' ||
     coalesce(interactive_config::text,'') || ' ' || coalesce(learning_objective,'') || ' ' || title, 'profit', 'gi')) as profit_hits
from lessons
where slug in ('backtesting-your-strategy', 'demo-vs-live-account', 'smart-money-concepts-intro')
order by slug;

-- 2) Quiz shape unchanged: [option count, correctIndex, correct option text] per scenario.
--    Expected values were captured read-only from live before apply; only the two
--    rewritten correct options (backtesting #4 and #5) have new text. Expect 0 rows.
with expected(slug, fp) as (values
  ('demo-vs-live-account', '[[4, 0, "Real money triggers emotions absent in demo"], [4, 0, "Real money brings real psychological pressure"], [4, 0, "No — emotional factors on live are different"]]'::jsonb),
  ('backtesting-your-strategy', '[[4, 0, "Enter — this matches the rule"], [4, 0, "Skip — no signal here"], [4, 0, "Skip — wrong signal type for this system"], [4, 0, "A positive expectancy in the test — worth practising on demo next (not guaranteed live)"], [4, 0, "Test whether your rules showed an edge on historical data, without risking real money"]]'::jsonb),
  ('smart-money-concepts-intro', '[[4, 0, "Order Block"], [4, 0, "Liquidity Sweep"], [4, 0, "An imbalance/inefficiency in price that the market tends to revisit and fill"], [4, 0, "Change of Character"], [4, 0, "Institutional traders who move the market"]]'::jsonb)
), actual as (
  select slug,
         (select jsonb_agg(jsonb_build_array(jsonb_array_length(s->'options'), s->'correctIndex',
                   s->'options'->((s->>'correctIndex')::int)) order by o)
          from jsonb_array_elements(interactive_config->'scenarios') with ordinality t(s, o)) as fp
  from lessons
  where slug in ('backtesting-your-strategy', 'demo-vs-live-account', 'smart-money-concepts-intro')
)
select e.slug, e.fp as expected, a.fp as actual
from expected e left join actual a using (slug)
where a.fp is distinct from e.fp;

-- 3) New wording present (expect all true).
select
  (select interactive_config::text like '%Do positive results on demo guarantee the same results live?%' from lessons where slug = 'demo-vs-live-account') as demo_q,
  (select key_takeaways::text like '%Positive results on demo don''t guarantee the same results live.%' from lessons where slug = 'demo-vs-live-account') as demo_takeaway,
  (select interactive_config::text like '%not a guarantee of future results%' from lessons where slug = 'backtesting-your-strategy') as backtest_expl,
  (select interactive_config::text like '%Any trader who is currently doing well%' from lessons where slug = 'smart-money-concepts-intro') as smc_option;
