-- ==========================================================
-- Phase 2C: Curriculum Gap Expansion
--
-- Content-only migration — no schema change, no table/column/index/RLS/grant
-- change, no diagnostic change. 3 new lessons, 2 competency-tag fixes,
-- 1 content addition to an existing lesson, and 2 existing tool-only
-- lessons upgraded to also carry a scored quiz (enabled by the Phase 2C
-- lesson-page code change allowing a tool block + quiz block together).
-- Existing lesson content is never overwritten blind — all JSONB updates
-- merge onto whatever already exists.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. Resequence order_index to make room for the 3 new lessons.
-- Descending order first so no two rows in the same level ever
-- transiently collide on order_index while these run.
-- ----------------------------------------------------------

-- Level: middle (market_structure home) — insert Breakouts at position 2
update lessons set order_index = 5 where slug = 'timeframes-which-one-to-use';
update lessons set order_index = 4 where slug = 'fibonacci-retracement';
update lessons set order_index = 3 where slug = 'moving-averages-and-rsi';

-- Level: highschool (risk_management home) — insert Drawdown at position 1
update lessons set order_index = 5 where slug = 'building-a-trading-journal';
update lessons set order_index = 4 where slug = 'risk-reward-ratio';
update lessons set order_index = 3 where slug = 'trading-psychology';
update lessons set order_index = 2 where slug = 'stop-loss-and-take-profit';

-- Level: college (gold home) — insert Gold Behavior at position 1
update lessons set order_index = 5 where slug = 'building-your-first-strategy';
update lessons set order_index = 4 where slug = 'smart-money-concepts-intro';
update lessons set order_index = 3 where slug = 'backtesting-your-strategy';
update lessons set order_index = 2 where slug = 'gold-trading-sessions-manila-time';

-- ----------------------------------------------------------
-- 2. New lesson: Breakouts, Consolidation & False Breakouts (market_structure)
-- ----------------------------------------------------------
insert into lessons (
  level_id, slug, title, learning_objective, content, key_takeaways,
  lesson_type, interactive_config, order_index, estimated_minutes,
  competency_key, prerequisite_lesson_id, passing_score, is_published
)
select
  (select level_id from lessons where slug = 'market-structure-and-trends'),
  'breakouts-and-consolidation',
  'Breakouts, Consolidation & False Breakouts',
  'Recognize consolidation (a range), identify a genuine breakout, and spot a false breakout (fakeout) before acting on it.',
  'When price stops making new highs or lows and just bounces between a support and resistance level, it''s consolidating — building energy before its next move.

A breakout happens when price closes clearly beyond that range, often with a bigger candle than usual. But not every push beyond the range sticks — a false breakout (fakeout) happens when price pokes through the level, then snaps back inside the range just as fast.

The safer approach: wait for a candle to close beyond the level, not just touch it, before treating it as a real breakout.',
  '["Consolidation is price bouncing inside a range, not trending — it often comes before a breakout.", "A false breakout pokes through a level then snaps back inside the range — waiting for a candle to close beyond the level filters out many of these."]'::jsonb,
  'scenario_quiz',
  '{"scenarios": [
    {
      "icon": "📊",
      "chart": [{"o":2300,"h":2308,"l":2295,"c":2302},{"o":2302,"h":2306,"l":2292,"c":2298},{"o":2298,"h":2305,"l":2290,"c":2304},{"o":2304,"h":2309,"l":2296,"c":2300}],
      "question": "Price has been bouncing between the same high and low for several candles (see chart). What is this called?",
      "options": ["Consolidation/a range", "A strong uptrend", "A breakout", "A reversal"],
      "correctIndex": 0,
      "explanation": "Price moving sideways between a support and resistance level, without pushing to new highs or lows, is consolidation."
    },
    {
      "icon": "⚠️",
      "chart": [{"o":2300,"h":2308,"l":2295,"c":2302},{"o":2302,"h":2306,"l":2292,"c":2298},{"o":2300,"h":2318,"l":2298,"c":2303}],
      "question": "Price spikes above resistance, but the candle closes back below it (see chart). What just happened?",
      "options": ["A false breakout (fakeout)", "A confirmed breakout", "A new support level", "A Golden Cross"],
      "correctIndex": 0,
      "explanation": "The candle closed back inside the range — the breakout didn''t hold. This is a false breakout."
    },
    {
      "icon": "🚀",
      "chart": [{"o":2300,"h":2308,"l":2295,"c":2302},{"o":2302,"h":2306,"l":2292,"c":2298},{"o":2300,"h":2322,"l":2299,"c":2318}],
      "question": "Price breaks above resistance and the candle closes clearly beyond it (see chart). What''s the safer read?",
      "options": ["This looks like a confirmed breakout", "This is definitely a false breakout", "This means the trend is reversing", "This means the spread has changed"],
      "correctIndex": 0,
      "explanation": "A candle that closes beyond the level, not just wicks through it, is a stronger signal of a genuine breakout — still not a guarantee."
    },
    {
      "icon": "🤔",
      "question": "Why does waiting for a candle close (instead of acting the moment price touches a level) help avoid false breakouts?",
      "options": ["A close confirms price held beyond the level instead of just spiking through it", "It guarantees the breakout will continue", "It has nothing to do with false breakouts", "It only matters on higher timeframes"],
      "correctIndex": 0,
      "explanation": "Waiting for the close filters out many fakeouts — it''s not a guarantee, but it''s a meaningfully safer read than reacting to a wick."
    }
  ]}'::jsonb,
  2,
  6,
  'market_structure',
  (select id from lessons where slug = 'support-and-resistance-zones'),
  70,
  true;

-- ----------------------------------------------------------
-- 3. New lesson: Drawdown, Losing Streaks & Account Survival (risk_management)
-- ----------------------------------------------------------
insert into lessons (
  level_id, slug, title, learning_objective, content, key_takeaways,
  lesson_type, interactive_config, order_index, estimated_minutes,
  competency_key, prerequisite_lesson_id, passing_score, is_published
)
select
  (select level_id from lessons where slug = 'position-sizing-and-lot-calculation'),
  'drawdown-and-losing-streaks',
  'Drawdown, Losing Streaks & Account Survival',
  'Understand how drawdown compounds after a losing streak, why recovering from a loss needs a bigger gain than the loss itself, and why increasing lot size after losses makes this worse, not better.',
  'A losing streak doesn''t just cost you money — it costs you disproportionately more to recover. Lose 20% of your account, and you need a 25% gain just to get back to even. Lose 50%, and you need a 100% gain — double your account — just to break even.

This is why risking a fixed 1-2% per trade (not increasing it after losses) matters so much: it keeps any single losing streak survivable.

A common and dangerous reaction to a losing streak is to increase lot size to "win it back faster." This does the opposite — it makes the next loss bigger, digging the hole deeper instead of climbing out of it.',
  '["The bigger the drawdown, the disproportionately bigger the gain needed to recover — a 50% loss needs a 100% gain to break even.", "Increasing lot size after a losing streak to recover faster makes losses bigger, not smaller — it''s one of the fastest ways to blow an account."]'::jsonb,
  'scenario_quiz',
  '{"scenarios": [
    {
      "icon": "📉",
      "question": "Your account drops from $1,000 to $800 (a 20% loss). Roughly what gain do you need to get back to $1,000?",
      "options": ["25%", "20%", "10%", "50%"],
      "correctIndex": 0,
      "explanation": "$800 needs a $200 gain to reach $1,000 — $200/$800 = 25%. Losses and the recovery gain needed are not symmetrical."
    },
    {
      "icon": "📉",
      "question": "Your account drops 50%, from $1,000 to $500. What gain is needed to recover back to $1,000?",
      "options": ["100%", "50%", "75%", "150%"],
      "correctIndex": 0,
      "explanation": "$500 needs to double to reach $1,000 — a 100% gain. The deeper the drawdown, the more disproportionate the recovery required."
    },
    {
      "icon": "🚨",
      "question": "You just lost 4 trades in a row risking 1% each. You consider risking 5% on the next trade to \"catch up faster.\" What''s the risk here?",
      "options": ["A single loss at 5% risk undoes 5 trades'' worth of 1% losses — it makes the hole deeper, not shallower", "It guarantees you recover faster", "It has no real downside if you''re confident", "It''s the same risk as always, just faster"],
      "correctIndex": 0,
      "explanation": "Increasing size after losses means your next loss (which is never guaranteed not to happen) costs far more — this is how accounts blow up."
    },
    {
      "icon": "🛡️",
      "question": "Why does sticking to a fixed 1-2% risk per trade, even during a losing streak, help protect an account?",
      "options": ["It keeps any realistic losing streak survivable, since no single loss is ever large relative to the account", "It guarantees you won''t lose money", "It means losing streaks never happen", "It only matters for large accounts"],
      "correctIndex": 0,
      "explanation": "Fixed, small risk per trade is precisely what keeps a losing streak from turning into a blown account."
    }
  ]}'::jsonb,
  1,
  6,
  'risk_management',
  (select id from lessons where slug = 'position-sizing-and-lot-calculation'),
  70,
  true;

-- ----------------------------------------------------------
-- 4. New lesson: Understanding Gold's Market Behavior (gold)
-- ----------------------------------------------------------
insert into lessons (
  level_id, slug, title, learning_objective, content, key_takeaways,
  lesson_type, interactive_config, order_index, estimated_minutes,
  competency_key, prerequisite_lesson_id, passing_score, is_published
)
select
  (select level_id from lessons where slug = 'gold-trading-sessions-manila-time'),
  'understanding-golds-market-behavior',
  'Understanding Gold''s Market Behavior',
  'Understand the main forces that move Gold''s price — fear and safe-haven demand, US Dollar strength, and reaction to major scheduled news — without treating any of them as a guaranteed signal.',
  'Gold doesn''t move randomly — a few forces drive most of its price action.

Safe-haven demand: when there''s fear or uncertainty in the markets (economic, political, or otherwise), investors often move money into Gold, which tends to push its price up. This isn''t guaranteed — it''s a tendency, not a rule.

US Dollar strength: since Gold is priced in US Dollars, a stronger Dollar tends to make Gold relatively more expensive for other currencies, often pushing Gold''s price down — and a weaker Dollar often has the opposite effect.

Scheduled news reactions: Gold can move sharply around major scheduled economic announcements, as the market quickly reprices based on new information. The exact direction isn''t predictable in advance — what''s predictable is that volatility often increases around these times.',
  '["Gold often rises during fear/uncertainty (safe-haven demand) and often falls when the US Dollar strengthens — both are tendencies, not guarantees.", "Gold can move sharply around major scheduled news releases — volatility increasing is predictable, direction is not."]'::jsonb,
  'scenario_quiz',
  '{"scenarios": [
    {
      "icon": "💵",
      "question": "The US Dollar strengthens sharply. What does Gold tend to do?",
      "options": ["Tend to fall, since Gold is priced in Dollars", "Always rise", "Stay completely flat", "Become untradeable"],
      "correctIndex": 0,
      "explanation": "A stronger Dollar tends to make Gold relatively more expensive, which tends to push its price down — not a guarantee, but a common pattern."
    },
    {
      "icon": "😨",
      "question": "There''s sudden political or economic uncertainty in the news. What does Gold tend to do?",
      "options": ["Tend to rise, as investors seek safe-haven assets", "Always crash", "Become fixed in price", "Stop trading"],
      "correctIndex": 0,
      "explanation": "Fear and uncertainty tend to push money into Gold as a safe-haven — a tendency, not a guaranteed outcome."
    },
    {
      "icon": "📰",
      "question": "A major scheduled economic announcement is about to be released. What should a trader expect?",
      "options": ["Volatility often increases — but the direction of the move isn''t predictable in advance", "Gold will definitely rise", "Gold will definitely fall", "Nothing unusual will happen"],
      "correctIndex": 0,
      "explanation": "Scheduled news often increases volatility — but predicting the exact direction in advance isn''t reliable."
    },
    {
      "icon": "🧠",
      "question": "Why is it safer to say Gold \"tends to\" rise during fear rather than \"Gold always rises\" during fear?",
      "options": ["Because it''s a common tendency, not a guaranteed rule — Gold can still fall even during uncertain times", "Because the first phrasing sounds nicer", "There''s no real difference", "Because Gold never actually reacts to fear"],
      "correctIndex": 0,
      "explanation": "Treating tendencies as guarantees is exactly the kind of overconfident thinking that leads to blown accounts — language matters."
    }
  ]}'::jsonb,
  1,
  6,
  'gold',
  (select id from lessons where slug = 'stocks-vs-forex-vs-gold'),
  70,
  true;

-- ----------------------------------------------------------
-- 5. Competency-tag fixes (data-only, resolves 2 of the 3 Phase 1 flags)
-- ----------------------------------------------------------
update lessons set competency_key = 'platform' where slug = 'pips-lots-and-leverage';
update lessons set competency_key = 'psychology' where slug = 'common-beginner-mistakes';
-- opening-your-accm-account intentionally remains untagged — confirmed, not an oversight.

-- ----------------------------------------------------------
-- 6. pips-lots-and-leverage: append leverage content (existing content
-- preserved, nothing removed), append 1 key takeaway, append 2 new
-- scenario questions to whatever scenarios already exist.
-- ----------------------------------------------------------
update lessons
set
  content = content || '

Leverage lets you control a larger position than your account balance alone would allow — e.g., with 1:100 leverage, a $1,000 account can open positions worth up to $100,000. This is what makes small accounts able to trade standard-sized positions at all — but it''s also exactly why the risk rules in Position Sizing & Lot Calculation matter: leverage doesn''t change how much you should risk, only how much buying power you have access to.',
  key_takeaways = key_takeaways || '["Leverage (e.g., 1:100) lets a small account control a larger position size — it increases buying power, not how much you should actually risk per trade."]'::jsonb,
  interactive_config = jsonb_set(
    interactive_config,
    '{scenarios}',
    coalesce(interactive_config->'scenarios', '[]'::jsonb) || '[
      {
        "icon": "⚖️",
        "question": "With 1:100 leverage, how much position size can a $1,000 account control?",
        "options": ["Up to $100,000", "Exactly $1,000", "Up to $10,000", "Unlimited"],
        "correctIndex": 0,
        "explanation": "1:100 leverage means $1,000 of capital can control up to $100,000 of position size — leverage is about buying power, not about how much you should risk."
      },
      {
        "icon": "🧮",
        "question": "Does using leverage change how much of your account you should risk per trade?",
        "options": ["No — the 1-2% risk rule still applies regardless of leverage", "Yes, higher leverage means you should risk more", "Yes, leverage replaces the need for a stop loss", "Leverage has nothing to do with trading"],
        "correctIndex": 0,
        "explanation": "Leverage changes your buying power, not your risk discipline — the 1-2% rule from Position Sizing still applies."
      }
    ]'::jsonb
  )
where slug = 'pips-lots-and-leverage';

-- ----------------------------------------------------------
-- 7. candlestick-anatomy: add a scored quiz alongside the existing
-- candlestick_plot tool (lesson_type unchanged — the plotter and
-- freehand practice keep rendering exactly as before).
-- ----------------------------------------------------------
update lessons
set
  passing_score = 70,
  interactive_config = coalesce(interactive_config, '{}'::jsonb) || '{"scenarios": [
    {
      "icon": "🕯️",
      "chart": [{"o":2300,"h":2318,"l":2298,"c":2314}],
      "question": "Is this candle bullish or bearish?",
      "options": ["Bullish — close is above open", "Bearish — close is below open", "Neither, it''s a doji", "Can''t tell without volume"],
      "correctIndex": 0,
      "explanation": "Close above open means bullish — buyers were in control by the end of the candle."
    },
    {
      "icon": "📐",
      "question": "What are the four values that make up a candlestick?",
      "options": ["Open, High, Low, Close", "Open, Close, Volume, Time", "High, Low, Volume, Spread", "Bid, Ask, Open, Close"],
      "correctIndex": 0,
      "explanation": "OHLC — Open, High, Low, Close — are the four values every candlestick represents."
    },
    {
      "icon": "🕯️",
      "chart": [{"o":2322,"h":2325,"l":2298,"c":2300}],
      "question": "Is this candle bullish or bearish?",
      "options": ["Bearish — close is below open", "Bullish — close is above open", "A doji", "Can''t tell without volume"],
      "correctIndex": 0,
      "explanation": "Close below open means bearish — sellers dominated this candle."
    }
  ]}'::jsonb
where slug = 'candlestick-anatomy';

-- ----------------------------------------------------------
-- 8. moving-averages-and-rsi: add a scored quiz alongside the existing
-- RSI/MA tool (lesson_type unchanged, tool keeps rendering as before).
-- ----------------------------------------------------------
update lessons
set
  passing_score = 70,
  interactive_config = coalesce(interactive_config, '{}'::jsonb) || '{"scenarios": [
    {
      "icon": "🔀",
      "question": "The 50 MA crosses above the 200 MA. What is this called, and how is it generally read?",
      "options": ["Golden Cross — generally read as bullish", "Death Cross — generally read as bearish", "Golden Cross — generally read as bearish", "It has no name"],
      "correctIndex": 0,
      "explanation": "A Golden Cross (50 MA above 200 MA) is generally read as bullish."
    },
    {
      "icon": "📉",
      "question": "RSI is reading 25. What does this generally suggest?",
      "options": ["Possibly oversold — a potential (not guaranteed) bounce zone", "Definitely about to crash further", "Overbought", "Meaningless"],
      "correctIndex": 0,
      "explanation": "Below 30 suggests oversold conditions — a potential bounce zone, never a guaranteed signal on its own."
    },
    {
      "icon": "🔀",
      "question": "The 50 MA crosses below the 200 MA. What is this called?",
      "options": ["Death Cross — generally read as bearish", "Golden Cross", "A Fibonacci retracement", "A liquidity sweep"],
      "correctIndex": 0,
      "explanation": "A Death Cross (50 MA below 200 MA) is generally read as bearish."
    }
  ]}'::jsonb
where slug = 'moving-averages-and-rsi';
