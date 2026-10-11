-- Verify 20261011160000_cents_account_policy.sql (read-only).

-- 1) Each lesson mentions the cents account exactly where expected. Expect all true.
select slug,
  content like '%cents account%'                                        as content_has_cents,
  (slug = 'opening-your-accm-account' or key_takeaways::text like '%Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.%') as takeaway_has_standard_line,
  jsonb_array_length(key_takeaways)                                     as n_takeaways,  -- expect 4, 3, 3
  (select count(*) from regexp_matches(content, 'cents account', 'g'))  as cents_mentions
from lessons
where slug in ('demo-account-your-practice-ground', 'demo-vs-live-account', 'opening-your-accm-account')
order by slug;

-- 2) Risk warnings still present and no guarantee language added. Expect all true.
select
  (select content like '%Trading involves real risk of loss.%' and content like '%Practice on a demo account first, risk no more than 1\% of your account per trade, and always use a stop loss.%'
     from lessons where slug = 'demo-account-your-practice-ground') as demo_footer_kept,
  (select content like '%Losses are still real, and results are not guaranteed.%'
     from lessons where slug = 'demo-vs-live-account')             as dvl_caution,
  (select content like '%Disclosure: GFX Society''s founder is an Introducing Broker (IB) for ACCM.%'
     from lessons where slug = 'opening-your-accm-account')        as accm_disclosure_kept,
  (select bool_and(content !~* 'guarantee(d)? (profit|results)\M' or content ~* 'not guaranteed|don''t guarantee')
     from lessons where slug in ('demo-account-your-practice-ground','demo-vs-live-account','opening-your-accm-account')) as no_new_guarantee;

-- 3) Quiz items unchanged: [option count, correctIndex, correct option]. Expect 0 rows.
with expected(slug, fp) as (values
  ('demo-account-your-practice-ground', '[[4, 1, "Weeks of consistently following your plan"], [4, 0, "0.02 lot"], [4, 1, "Demo fills can be smoother and there''s no real emotional pressure"]]'::jsonb),
  ('demo-vs-live-account', '[[4, 0, "Real money triggers emotions absent in demo"], [4, 0, "Real money brings real psychological pressure"], [4, 0, "No — emotional factors on live are different"]]'::jsonb)
), actual as (
  select slug, (select jsonb_agg(jsonb_build_array(jsonb_array_length(s->'options'), s->'correctIndex',
           s->'options'->((s->>'correctIndex')::int)) order by o)
         from jsonb_array_elements(interactive_config->'scenarios') with ordinality t(s, o)) as fp
  from lessons where slug in ('demo-account-your-practice-ground', 'demo-vs-live-account')
)
select e.slug, e.fp, a.fp from expected e left join actual a using (slug) where a.fp is distinct from e.fp;
