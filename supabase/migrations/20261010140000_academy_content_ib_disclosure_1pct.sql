-- ==========================================================
-- Academy content fixes (launch Mon 12 Oct 2026)
-- Content-only migration. NOT APPLIED. Founder applies after review.
-- No schema / RLS / grant change. Each update is guarded so re-running is a no-op.
--   1. what-is-a-spread: add IB disclosure where ACCM is named
--      (wording: compliance/ib-disclosure.md "Short disclosure"; placeholders = TODO)
--   2. position-sizing-and-lot-calculation: 1% max risk standard (brief §3)
--   3. demo-account-your-practice-ground: "4 profitable weeks" -> weeks following your plan
-- ==========================================================

-- 1. What is a Spread? -- append IB disclosure to content (only once)
update lessons
set content = content || E'\n\nDisclosure: GFX Society''s founder is an Introducing Broker (IB) for ACCM. If you open an account or trade through our link, we earn [TODO: COMPENSATION_TYPE, e.g. rebates per lot traded] from ACCM. [TODO: COST_IMPACT_STATEMENT - must be verified with the ACCM IB agreement before launch] You can trade with any broker you choose. Spreads vary by broker, account type and market conditions. Education only, not financial advice.',
    updated_at = now()
where slug = 'what-is-a-spread'
  and content not like '%Introducing Broker (IB)%';

update lessons
set key_takeaways = key_takeaways || to_jsonb('GFX''s founder is an IB for ACCM and may earn rebates; you can use any broker.'::text),
    updated_at = now()
where slug = 'what-is-a-spread'
  and not (key_takeaways::text like '%IB for ACCM%');

-- 2. Position Sizing -- 1% standard; worked example already uses 1% ($1,000 x 1% = $10; 50 pip SL x $1.00/pip/lot -> 0.20 lot)
update lessons
set content = replace(content,
      'Never risk more than 1 to 2% of your account per trade.',
      'Never risk more than 1% of your account per trade (the GFX standard), and always use a stop-loss.'),
    key_takeaways = replace(key_takeaways::text,
      'Never risk more than 1-2% of your account on a single trade.',
      'Never risk more than 1% of your account on a single trade.')::jsonb,
    updated_at = now()
where slug = 'position-sizing-and-lot-calculation'
  and (content like '%1 to 2%%' or key_takeaways::text like '%1-2%%');

-- 3. Demo Account -- process over P&L
update lessons
set content = replace(content,
      'Aim for at least 4 profitable weeks before switching to live',
      'Aim for at least 4 weeks of following your trading plan consistently (1% risk, stop-loss on every trade) before considering live'),
    key_takeaways = replace(key_takeaways::text,
      'Aim for several consistent profitable weeks on demo before considering live trading.',
      'Aim for several weeks of following your plan consistently on demo before considering live trading.')::jsonb,
    interactive_config = replace(replace(interactive_config::text,
      'At least several consistent profitable weeks',
      'Several weeks of following your plan consistently'),
      'Consistency over weeks is the standard. If you can''t be profitable on demo, live will be harder, not easier.',
      'Consistency over weeks is the standard: follow your plan, risk 1%, and use a stop-loss every time. If you can''t follow your plan on demo, live will be harder, not easier.')::jsonb,
    updated_at = now()
where slug = 'demo-account-your-practice-ground';
