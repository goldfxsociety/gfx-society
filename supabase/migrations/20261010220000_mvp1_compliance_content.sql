-- ==========================================================
-- MVP-1: Academy compliance content. FILE ONLY - NOT APPLIED. Founder applies.
-- Content-only (lessons, levels). No schema/RLS/grant change.
-- Idempotent: every statement is guarded by a WHERE clause that matches only
-- the OLD live text (verified read-only 10 Oct 2026), so re-running is a no-op.
-- IB wording: founder-approved neutral text; NO cost-parity claim.
-- ==========================================================
begin;

-- 1. What is a Broker?: remove 'regulated' + spread/execution claims, add disclosure, replace ACCM-recommendation quiz
update lessons set content = $t$A broker is the middleman between you and the market. Without one, you cannot place trades.

How to choose a broker: check its licence on the regulator's public register, which legal entity you are signing up with, its spreads and fees, and its platform (e.g. MT5). Always start on a demo account.

The Academy's examples use ACCM's MT5 platform. Disclosure: GFX Society's founder is an Introducing Broker (IB) for ACCM. GFX may earn a commission or rebate from partner brokers when you open an account or trade through our links. You can use any broker you choose. Education only, not financial advice.$t$,
  key_takeaways = $j$["A broker is the required middleman — you cannot trade directly on the market without one.", "The spread is how a broker primarily earns revenue.", "Verify any broker's licence and legal entity yourself before depositing; GFX's founder is an IB for ACCM and GFX may earn a commission or rebate."]$j$::jsonb,
  interactive_config = $j${"scenarios": [{"icon": "🤝", "options": ["Through the spread (Bid-Ask gap)", "From your losses only", "Monthly subscription", "By investing your funds"], "question": "How does a broker primarily earn revenue?", "explanation": "The spread is the broker's main revenue — built into every trade.", "correctIndex": 0}, {"icon": "🚫", "options": ["No — a broker is the required middleman", "Yes, anyone can trade directly", "Only large institutions need one", "Only for Gold, not other assets"], "question": "Can you trade directly on the market without a broker?", "explanation": "A broker is the middleman between you and the market — without one, you simply cannot place trades.", "correctIndex": 0}, {"icon": "⚖️", "options": ["Check its licence on the regulator's public register, the legal entity you sign up with, and its fees", "Pick whichever one a friend or influencer recommends", "Pick the one that promises the biggest bonus", "Pick the one with the highest leverage"], "question": "What should you check before choosing any broker?", "explanation": "Every broker is different. Verify licensing and the exact legal entity yourself, compare costs, and start on a demo account. No broker can guarantee profits.", "correctIndex": 0}]}$j$::jsonb,
  updated_at = now()
where slug = 'what-is-a-broker' and content like '%Regulated broker%';

-- 2. Opening Your ACCM Account: plan-following/demo-first, disclosure next to referral mention, no marketing claims
update lessons set content = $t$This lesson shows the general steps to open an account with ACCM, the broker used in the Academy's examples. You can use any broker you choose.

Disclosure: GFX Society's founder is an Introducing Broker (IB) for ACCM. GFX may earn a commission or rebate from partner brokers when you open an account or trade through our links. You can use any broker you choose. Education only, not financial advice.

Steps to get started:
1. Check the broker's licence and the legal entity you are signing up with on the regulator's public register
2. Register (GFX's referral link is optional - see the disclosure above)
3. Complete KYC (ID + selfie)
4. Open a DEMO account first
5. Only consider live trading after several weeks of following your trading plan consistently on demo (1% max risk, stop-loss on every trade), and only with money you can afford to lose$t$,
  key_takeaways = $j$["Check the broker's licence and legal entity, complete KYC, and start on a demo account.", "Move to live only after weeks of following your plan consistently on demo (1% risk, stop-loss every trade), never because of a profit target.", "GFX's founder is an IB for ACCM and GFX may earn a commission or rebate; you can use any broker you choose."]$j$::jsonb,
  updated_at = now()
where slug = 'opening-your-accm-account' and content like '%consistently profitable%';

-- 3. Pips, Lots & Leverage: 1-2% -> 1%
update lessons set interactive_config = replace(replace(interactive_config::text,
    'No — the 1-2% risk rule still applies regardless of leverage',
    'No — the 1% max risk rule still applies regardless of leverage'),
    'the 1-2% rule from Position Sizing still applies.',
    'the 1% max rule from Position Sizing still applies.')::jsonb,
  updated_at = now()
where slug = 'pips-lots-and-leverage' and interactive_config::text like '%1-2\%%';

-- 4. Drawdown & Losing Streaks: 1-2% -> 1%
update lessons set content = replace(content,
    'risking a fixed 1-2% per trade (not increasing it after losses)',
    'risking a fixed 1% max per trade (not increasing it after losses)'),
  interactive_config = replace(interactive_config::text,
    'sticking to a fixed 1-2% risk per trade',
    'sticking to a fixed 1% max risk per trade')::jsonb,
  updated_at = now()
where slug = 'drawdown-and-losing-streaks'
  and (content like '%1-2\%%' or interactive_config::text like '%1-2\%%');

-- 5. What is a Spread?: remove 'ACCM typical spread 20-30 pips' claim (text, takeaway, quiz); keep the existing disclosure
update lessons set content = replace(content,
    'ACCM XAUUSD: typical spread 20 to 30 pips.',
    'Spreads on XAUUSD vary by broker and account type, and usually widen around major news and at session opens. Check the live spread on your own platform.'),
  key_takeaways = $j$["The spread is the difference between the Ask (buy) and Bid (sell) price.", "Gold spreads vary by broker, account type and market conditions — and widen around news.", "GFX's founder is an IB for ACCM and GFX may earn a commission or rebate; you can use any broker you choose."]$j$::jsonb,
  interactive_config = $j${"scenarios": [{"icon": "💰", "options": ["$0.30 which is 30 pips", "$2,300.00", "$0.03 which is 3 pips", "$3.00 which is 300 pips"], "question": "Bid is $2,300.00, Ask is $2,300.30. The spread is:", "explanation": "Spread = Ask minus Bid = $2,300.30 minus $2,300.00 = $0.30 = 30 pips.", "correctIndex": 0}, {"icon": "🏦", "options": ["The broker's built-in fee", "A government tax", "A bonus paid to traders", "An error in the price feed"], "question": "The spread is essentially:", "explanation": "The spread is the broker's main revenue — built into every single trade you place.", "correctIndex": 0}, {"icon": "📏", "options": ["It varies by broker, account type and market conditions — check your broker's live quote", "It is always exactly 20 pips", "It is the same at every broker", "There is no spread on Gold"], "question": "How big is the spread on XAUUSD?", "explanation": "Spreads differ between brokers and account types, and widen around news and session opens. Always check the live spread on your own platform before trading.", "correctIndex": 0}]}$j$::jsonb,
  updated_at = now()
where slug = 'what-is-a-spread'
  and (content like '%typical spread 20 to 30%' or key_takeaways::text like '%20-30 pips%' or interactive_config::text like '%20-30 pips%');

-- 6. Level copy
update levels set title = 'Level 6: Demo to Live — Are You Ready?', description = 'A readiness checklist: demo first, plan-following, 1% risk.'
where slug = 'graduation' and title = 'Level 6: You''re Ready to Trade Live';
update levels set description = 'Protecting your account: risk, discipline and mindset.'
where slug = 'highschool' and description = 'What separates winners from losers.';

commit;
