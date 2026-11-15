-- lesson-risk-dedupe, ROLLBACK (only if needed): restores the exact original content, key_takeaways and updated_at of the
-- 13 rows, by primary key id. Self-contained: the originals are embedded below as dollar-quoted literals (tag
-- $lrd_orig_20261115$), copied byte for byte from a read-only prod SELECT on 15 Nov 2026 (md5-checked).
-- One transaction, all or nothing:
--   * aborts unless all 13 ids exist with the expected level_id + slug;
--   * all 13 already back to the originals: NOTICE, changes nothing (safe rerun);
--   * otherwise aborts unless all 13 are in the exact AFTER state of 02_apply.sql (md5), so later edits are never clobbered;
--   * after the UPDATE, aborts (rolls back) unless every row matches the original md5s and updated_at.
-- No new table, schema, RLS or grant.
begin;

do $lrd_revert$
declare
  m constant jsonb := $m$[
    {"id": "ad3d52a1-544d-47e0-91d9-337503678387", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "bull-market-vs-bear-market", "before_content_md5": "8ffe115d75865b1b85547f8513942011", "before_tk_md5": "8106d2262297454982b96f5de4c8c68b", "after_content_md5": "6c3099ae81ea317867cfb1c00fcf53aa", "after_tk_md5": "8106d2262297454982b96f5de4c8c68b"},
    {"id": "d7926520-c96b-4d61-bd1e-0078b3b718a8", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "candlestick-anatomy", "before_content_md5": "6558bfa684e284247300583f10471488", "before_tk_md5": "bc34641c550ccdf6613615e6774abcba", "after_content_md5": "169d174c48a071b6525e8c69598c6b09", "after_tk_md5": "bc34641c550ccdf6613615e6774abcba"},
    {"id": "bf0e27f5-ab9b-4e63-8f77-8b0a692476e0", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "candlestick-patterns", "before_content_md5": "a5841a999bb1415134e5479bf8087fc6", "before_tk_md5": "6bd36462dfbe76c6eaf16ccbc7c3b4c5", "after_content_md5": "7591b248c8927757b8de5d456778b8ac", "after_tk_md5": "6bd36462dfbe76c6eaf16ccbc7c3b4c5"},
    {"id": "3cb8acf1-27ac-42fb-bd4d-95e5b18b00ef", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "cents-account-your-first-real-money-practice", "before_content_md5": "6c93a942562f94538ce5bf6abd5a5126", "before_tk_md5": "7e291402fd0a448b739e304ecc0d0fd5", "after_content_md5": "0800d99c8caaa6ec97ab8fc4fb9216bf", "after_tk_md5": "54d44d6e329af36fa9d98aa11e015c9f"},
    {"id": "94768e3c-a60b-4fb3-be16-c2e5c5a30132", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "how-do-traders-make-money", "before_content_md5": "4c620553ecc5bcabef29d3c22725b6ae", "before_tk_md5": "a6b4efb69a6beed146ae791c2f2e5740", "after_content_md5": "fa8748388e73f3b155432214e93b8989", "after_tk_md5": "a6b4efb69a6beed146ae791c2f2e5740"},
    {"id": "0a66d41e-7255-4028-8640-caf4497a4adb", "level_id": "e42c66c8-abee-47ec-9fa6-d5e67ee7cf34", "slug": "opening-your-accm-account", "before_content_md5": "d69d93cae69106738e37531725a745c3", "before_tk_md5": "c525c4d8ceacb8d94199d3df266b048c", "after_content_md5": "24802fe754f49fe681c60ea951ae0d6f", "after_tk_md5": "c525c4d8ceacb8d94199d3df266b048c"},
    {"id": "a1caf3d9-689a-4696-9443-f9f947a1dd05", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "pips-lots-and-leverage", "before_content_md5": "538f7e6634787f34de1aa344dc870f8a", "before_tk_md5": "32041a5a2404aef459c1cf93cd4a5075", "after_content_md5": "ce0f41adf5206cc6393d37d84754c8ba", "after_tk_md5": "32041a5a2404aef459c1cf93cd4a5075"},
    {"id": "5b957c8d-5ac5-45ee-bcbf-5bc7ec91d764", "level_id": "e42c66c8-abee-47ec-9fa6-d5e67ee7cf34", "slug": "real-money-and-your-emotions", "before_content_md5": "dde3513b596498c82e7b7d5cedcb063a", "before_tk_md5": "ee0d8c1c9381e0cec0705ddecfa9eb00", "after_content_md5": "dde3513b596498c82e7b7d5cedcb063a", "after_tk_md5": "134e01713ab0ec88676abe467baf4ad9"},
    {"id": "5698278e-2b5c-4706-8032-50cd517df741", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "stocks-vs-forex-vs-gold", "before_content_md5": "8cb39725effbc3cbd20ebbcc5f1d1464", "before_tk_md5": "d144c1b6f17543bf7ea89d9859d4d84b", "after_content_md5": "5cbf6bbe43000b48b88f845dca8ade11", "after_tk_md5": "d144c1b6f17543bf7ea89d9859d4d84b"},
    {"id": "c7eaf0f2-c415-4b9a-97c9-84f0095a721a", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "types-of-orders", "before_content_md5": "9fcaa647487977a9fa6fe7045e4505cb", "before_tk_md5": "f41df115db117c72686cb0a8adbd8adc", "after_content_md5": "bea5d07a350e90915af56669d413c0b6", "after_tk_md5": "f41df115db117c72686cb0a8adbd8adc"},
    {"id": "b123eaf2-b4fa-4ef0-8a07-bdaa190a3286", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "what-is-a-broker", "before_content_md5": "401f93b366a1a0f04eaf31313413e7be", "before_tk_md5": "723e3da319ab745cc352115d4ca13f24", "after_content_md5": "32fc035aacfd9b1503e8fe0c17940083", "after_tk_md5": "723e3da319ab745cc352115d4ca13f24"},
    {"id": "3ea5a6f7-d454-4734-8a8a-af15f8c0adca", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "what-is-a-spread", "before_content_md5": "f4e8a2adf44bd54ad63895591a62053b", "before_tk_md5": "2b187c5019300804d7d626db2875d327", "after_content_md5": "22b134661c145adf0a403a959300ae76", "after_tk_md5": "2b187c5019300804d7d626db2875d327"},
    {"id": "680c3ddf-a5e5-459d-bdf3-e8f06251e1de", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "what-is-the-financial-market", "before_content_md5": "b060d7825da63d98e7c78d95ea105616", "before_tk_md5": "725b232d36d43db78f0bbce3ab9cea77", "after_content_md5": "a7f3dbd1663e76def932496761b6dfa9", "after_tk_md5": "725b232d36d43db78f0bbce3ab9cea77"}
  ]$m$;
  n_ok int; n_before int; n_after int; n_upd int; states text;
begin
  if jsonb_array_length(m) <> 13 then raise exception 'lesson-risk-dedupe revert ABORTED: manifest has % rows, expected 13', jsonb_array_length(m); end if;

  perform 1 from public.lessons l where l.id in (select x.id from jsonb_to_recordset(m) as x(id uuid, level_id uuid, slug text, before_content_md5 text, before_tk_md5 text, after_content_md5 text, after_tk_md5 text)) for update;

  select count(*) filter (where s.state in ('ORIGINAL', 'AFTER', 'DRIFTED')),
         count(*) filter (where s.state = 'ORIGINAL'),
         count(*) filter (where s.state = 'AFTER'),
         string_agg(s.slug || '=' || s.state, ', ' order by s.slug)
    into n_ok, n_before, n_after, states
  from (
    select e.slug, case
        when l.id is null then 'MISSING'
        when l.level_id <> e.level_id or l.slug <> e.slug then 'WRONG_LEVEL_OR_SLUG'
        when md5(l.content) = e.before_content_md5 and md5(l.key_takeaways::text) = e.before_tk_md5 then 'ORIGINAL'
        when md5(l.content) = e.after_content_md5 and md5(l.key_takeaways::text) = e.after_tk_md5 then 'AFTER'
        else 'DRIFTED'
      end as state
    from jsonb_to_recordset(m) as e(id uuid, level_id uuid, slug text, before_content_md5 text, before_tk_md5 text, after_content_md5 text, after_tk_md5 text)
    left join public.lessons l on l.id = e.id
  ) s;

  if n_ok <> 13 then
    raise exception 'lesson-risk-dedupe revert ABORTED: expected 13 rows by id with the expected level_id + slug, found %. States: %', n_ok, states;
  end if;
  if n_before = 13 then
    raise notice 'lesson-risk-dedupe revert: all 13 rows already hold the original text. Nothing changed.';
    return;
  end if;
  if n_after <> 13 then
    raise exception 'lesson-risk-dedupe revert ABORTED, nothing changed: expected all 13 rows in the exact AFTER state, found original=% after=% (mixed or edited since apply). States: %', n_before, n_after, states;
  end if;

  update public.lessons l
  set content = o.content, key_takeaways = o.key_takeaways, updated_at = o.updated_at
  from jsonb_to_recordset(m) as e(id uuid, level_id uuid, slug text, before_content_md5 text, before_tk_md5 text, after_content_md5 text, after_tk_md5 text),
    (values
      ('ad3d52a1-544d-47e0-91d9-337503678387'::uuid,
       $lrd_orig_20261115$## TL;DR sa Taglish
Bull market = generally pataas ang price, with higher highs at higher lows. Bear market = pababa, with lower highs at lower lows. Madalas sideways lang ang market, at dito natatalo ang maraming beginners na pinipilit mag-trade. Pwedeng magbago ang trend anytime, kaya kahit sumasabay ka sa trend, laging may stop loss.
Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.

## Bull market
A bull market is a period when prices are generally rising. On a chart you typically see higher highs and higher lows: each rally goes a bit higher, and each pullback stops above the previous low.
Sa Taglish: Pataas ang price: bawat rally mas mataas, at bawat pullback humihinto above the previous low.

## Bear market
A bear market is a period when prices are generally falling, with lower highs and lower lows.
Sa Taglish: Pababa ang price, with lower highs at lower lows.

## Sideways (range)
Often the market is neither clearly rising nor falling but moving between a ceiling and a floor. Many beginners lose money by forcing trades in choppy ranges.
Sa Taglish: Minsan nasa pagitan lang ng ceiling at floor ang price. Huwag pilitin mag-trade sa choppy range.

## Trends change
A trend can end at any time. Identifying the current direction helps you plan, but it is not a guarantee. That is why every trade needs a stop loss, even when you are trading with the trend.
Sa Taglish: Walang guarantee ang trend; pwede itong matapos anytime, kaya kailangan pa rin ng stop loss.

## Timeframes change the picture
A market can look bullish on a daily chart and bearish on a 15-minute chart at the same time. Short timeframes show small swings inside the bigger move. Beginners often get confused by switching between charts. A simple habit is to check one higher timeframe for overall direction, then use one lower timeframe to plan entries, and to write down which timeframes you use in your plan.
Sa Taglish: Pwedeng bullish sa daily pero bearish sa 15-minute. Gumamit ng isang higher timeframe para sa direction at isang lower para sa entries, at isulat ito sa plan mo.

## Don't trade the label
Calling a market 'bullish' doesn't mean you must buy. Sometimes the best decision is to wait, especially when price is in the middle of a range, right before major news, or when you can't find a logical place for your stop loss. Waiting costs nothing; a forced trade can cost you up to your full planned risk.
Sa Taglish: Hindi porke "bullish" ay kailangan mong mag-buy. Okay lang maghintay, lalo na sa gitna ng range, bago ang big news, o kung walang logical na stop loss.

## Practice idea
On any XAUUSD chart (for example in MT5), mark the last three swing highs and lows on two different timeframes and decide: bullish, bearish or sideways? Write your answer, then check how price behaved afterward. You are training your eyes, not trying to predict.
Sa Taglish: Sa kahit anong XAUUSD chart, i-mark ang last 3 swing highs at lows sa dalawang timeframes, isulat kung bullish, bearish o sideways, tapos i-check after. Training ito ng mata, hindi prediction.

## Quick recap
Bullish means higher highs and higher lows, bearish means lower highs and lower lows, and sideways means price is stuck between a ceiling and a floor. Identify the structure first, decide whether there is a clear, low-risk plan, and only then think about a trade, always with a stop loss and max 1% risk.
Sa Taglish: Structure muna: bullish, bearish o sideways? Tapos tingnan kung may clear, low-risk plan, laging may stop loss at max 1% risk.

## Gold example (hypothetical): Spotting higher highs and higher lows
• Hypothetical swings on XAUUSD: low 2,320 → high 2,340 → low 2,330 → high 2,352 → low 2,341.
• Each high is higher (2,340 → 2,352) and each low is higher (2,320 → 2,330 → 2,341): this is a bullish structure.
• If price later breaks below 2,341 and then fails to make a new high, the bullish structure may be ending.
• A stop loss placed below a recent higher low (e.g. below 2,341) limits the loss if the trend fails.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.
Sa Taglish: Higher highs at higher lows = bullish structure. Kapag nabasag ang 2,341 at walang bagong high, baka patapos na ito; ang stop loss below the higher low ay naglilimit ng talo.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["Bull markets show higher highs and higher lows; bear markets show lower highs and lower lows.", "Sideways ranges are common, and forcing trades in choppy markets is a frequent beginner mistake.", "Trends can end without warning, so every trade still needs a stop loss."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('d7926520-c96b-4d61-bd1e-0078b3b718a8'::uuid,
       $lrd_orig_20261115$What a candle shows
Each candlestick summarizes price over one period (for example 1 hour). It shows four prices: open, high, low and close (OHLC).

Body and wicks
The body spans the open and close. A bullish candle (often green) closed higher than it opened; a bearish candle (often red) closed lower. The thin lines above and below are wicks (shadows), showing the highest and lowest prices reached.

Reading the story
A long upper wick means buyers pushed price up but it was pushed back down before the close. A long lower wick shows the opposite. A small body means little net change between open and close.

Context matters
A single candle is only one piece of information. Read it together with the trend, key levels, and timeframe, and never treat one candle as a guaranteed signal.

Timeframes and candles
The same price action looks different depending on the timeframe you choose. One daily candle contains the information of 24 one-hour candles. A big bullish daily candle may include several bearish hourly candles inside it. When you describe a candle, always say which timeframe it is from, for example 'the 1-hour candle closed bullish.'

Bid charts and gaps
Most charts are drawn using bid prices, so the high and low you see may not exactly match where a buy order could have filled. Also, when the market reopens after the weekend, the first candle may open far from the previous close; this is called a gap, and stop losses can be filled at the gap price instead of their exact level.

Practice
On any XAUUSD chart, pick five candles and write down open, high, low, close, body size and wick sizes for each. Doing this by hand a few times builds the reading skill you will use in every later lesson.

Quick recap
Every candle answers four questions: where did price start, how high did it go, how low did it go, and where did it finish? Answer those four first, every time, before you try to interpret anything else on the chart.

Gold example (hypothetical): Reading one hypothetical 1-hour gold candle
• Open 2,350.00, High 2,356.00, Low 2,347.00, Close 2,354.00.
• Close is above open → bullish candle. Body = 2,354.00 − 2,350.00 = $4.00.
• Upper wick = 2,356.00 − 2,354.00 = $2.00; lower wick = 2,350.00 − 2,347.00 = $3.00.
• Total range = 2,356.00 − 2,347.00 = $9.00. On 0.01 lot (1 oz), that hour's full range equals $9.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.

Taglish summary
Bawat candle may 4 na presyo: Open, High, Low, Close. Ang body ay mula open hanggang close; green kung tumaas, red kung bumaba. Ang wicks ay nagpapakita ng pinakamataas at pinakamababang naabot. Pero isang candle lang 'yan, laging tingnan ang context (trend, levels), at hindi ito garantiya.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["Each candle shows open, high, low and close (OHLC) for one time period.", "The body shows open-to-close; wicks show the high and low reached.", "Read candles in context, since a single candle is never a guaranteed signal."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('bf0e27f5-ab9b-4e63-8f77-8b0a692476e0'::uuid,
       $lrd_orig_20261115$Why patterns
Patterns are recurring candle shapes that some traders use to describe shifts between buyers and sellers. They are descriptive tools, not predictions.

Common patterns
Doji: open and close almost equal, showing indecision. Hammer: small body near the top with a long lower wick, appearing after a decline; it suggests sellers pushed down but buyers pushed back. Shooting star: the opposite, a long upper wick after a rise. Engulfing: a candle whose body fully covers the previous candle's body, bullish or bearish.

Context and confirmation
A pattern at a meaningful level (like prior support) in line with the bigger trend is more informative than one in the middle of nowhere. Many traders wait for the next candle to confirm before acting.

Limits
Patterns fail often. Use them as one input in a written plan, with a stop loss and a position size based on max 1% risk. Practice spotting them on past charts and record the outcomes honestly in a journal.

Common beginner mistakes
Seeing patterns everywhere: almost any chart shows a doji or hammer somewhere, so focus on patterns at levels you marked in advance. Ignoring the trend: a single bullish pattern in a strong downtrend is often just a pause. Entering too early: acting before the candle has closed, when its final shape may change. Sizing up because a pattern 'looks perfect': no pattern justifies risking more than 1%.

Track your results honestly
If you use patterns, keep a simple journal: pattern, timeframe, level, whether you took the trade, and the outcome. After many logged trades and chart reviews you will see how often a pattern actually helped in your plan, which is more useful than any general claim about pattern reliability.

Quick recap
Learn a few patterns well instead of many patterns poorly. Doji, hammer, shooting star and engulfing are enough for now. Look for them only at levels you marked in advance, wait for the candle to close, and let your written plan, stop loss and 1% rule decide what happens next, not excitement about the pattern.

Gold example (hypothetical): A hypothetical hammer at support
• Gold has fallen to an area near 2,330.00 that acted as support before (hypothetical).
• A 1-hour candle: Open 2,333.00, Low 2,326.00, Close 2,334.50, High 2,335.00 → small body near the top, long lower wick = hammer shape.
• A trader's plan might consider a long only if the next candle closes higher, with a stop loss below the wick (e.g. 2,325.00).
• If price instead breaks below 2,325.00, the stop loss closes the trade at a planned, limited loss.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.

Taglish summary
Ang candlestick patterns (doji, hammer, shooting star, engulfing) ay paraan para basahin ang labanan ng buyers at sellers. Pero hindi sila hula o garantiya, madalas din silang pumalya. Mas may saysay kung nasa importanteng level at may confirmation. Laging may stop loss at 1% max risk, at i-practice muna ang pag-spot sa past charts.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["Patterns like doji, hammer, shooting star and engulfing describe buyer/seller shifts.", "Patterns matter more at key levels and with confirmation, and they still fail often.", "Use patterns as one input in a written plan with a stop loss and max 1% risk."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 11:55:48.592883+00'::timestamptz),
      ('3cb8acf1-27ac-42fb-bd4d-95e5b18b00ef'::uuid,
       $lrd_orig_20261115$What a cents account is
A cents account is a real-money account whose balance is shown in cents (for example, a $10 deposit shows as 1,000) and that allows very small lot sizes. Not every broker offers one. The money is real, so losses are real too. That's the point: you practice your plan, sizing and emotions while the amount at stake stays small.

What to practice
Placing orders with a stop loss every time; calculating lot size from 1% risk; following a written plan; journaling every trade (reason, entry, stop, outcome, and whether you followed your rules).

Why start small with real money
Virtual money doesn't trigger fear, greed or the urge to 'bawi' after a loss. Small real money does. Dito mo makikilala ang sarili mo as a trader habang maliit pa ang taya. Results are not guaranteed, and GFX makes no profit promises.

Optional: the MT5 demo, for the buttons only
If you've never used MT5, you can open a free demo inside the MT5 app just to learn where Buy, Sell, SL/TP and Close are. Hindi ito required, at hindi nito tine-train ang emotions mo, kaya huwag itong gawing sukatan ng readiness. Trading at all is optional. Seek your own independent advice.

Setting up your cents account
Decide your budget first: only money you can afford to lose completely, hindi pambayad sa bills, utang, tuition o emergency fund. Don't top up after a loss. Check the broker's minimum deposit and fees. Then write a one-page plan: which market (XAUUSD), which timeframes, entry idea, where stops go, max 1% risk, and when you will not trade (for example, right before major news).

Weekly review
Once a week, review your journal: how many trades followed every rule, which mistakes repeated, and one thing to improve next week. Progress means fewer rule breaks over time.

Small money, same rules
It's tempting to take random trades because 'maliit lang naman.' Resist that. Every trade should follow the same size rules, the same stop loss habit and the same journal entry. The habits you build here are the habits you will carry forward, good or bad.

Quick recap
The cents account is where you build discipline with small real money. Practice the full routine on every trade, review weekly, and measure progress by rule-following, not by your balance.

Gold example (hypothetical): A week-one routine
Halimbawa lang / example only.
• Hypothetical $1,000 account. Rule: max 1% risk ($10) per trade, stop loss always.
• Trade idea: buy XAUUSD at 2,350.00, stop 2,346.00 ($4.00 per oz). Size = $10 ÷ $4 = 2.5 oz → round down to 0.02 lot (2 oz, $8 risk).
• Journal entry: reason for entry, SL/TP levels, size, result, and a yes/no: 'Did I follow my plan?'
• At week's end, count rule-following trades, not the balance.
Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary, and cents accounts use different contract sizes. Always check your own broker's contract specifications.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.

Taglish summary
Ang cents account ay real money pero maliit lang: naka-display ang balance in cents at napakaliit ng lot size. Dito mo ma-train ang emotions at money habits mo habang maliit ang taya. Pera lang na kaya mong mawala, max 1% risk per trade, laging may stop loss, at i-journal ang bawat trade. Optional ang MT5 demo, para lang matutunan ang buttons. Hindi required mag-trade, at walang profit promises.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["A cents account is small real money: balance shown in cents, very small lot sizes, real losses.", "Practice stop losses, 1% sizing, your written plan and journaling on every trade, kahit maliit ang account.", "Measure progress by weeks of following your plan, not by your balance or profits.", "Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('94768e3c-a60b-4fb3-be16-c2e5c5a30132'::uuid,
       $lrd_orig_20261115$## TL;DR sa Taglish
Pwede kang mag-buy (go long) kung expect mong tataas ang price, o mag-sell (go short) kung bababa, and either way pwede kang matalo. Walang trader na laging panalo; normal ang losing streaks. Ang mahalaga ay controlled ang talo: max 1% ng account per trade, laging may stop loss. May costs din ang bawat trade, like the spread. GFX does not promise profits; ang goal ay matuto at protektahan ang capital mo, starting small.
Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.

## Two directions
Traders try to benefit from price changes. If you buy (go long) and the price rises, the position gains; if it falls, it loses. If you sell (go short) and the price falls, the position gains; if it rises, it loses. With CFDs and forex-style platforms you can go long or short without owning physical gold.
Sa Taglish: Sa long, nag-ga-gain ang position kapag tumaas ang price; sa short, kapag bumaba. Kapag kabaligtaran ang galaw, talo ang position.

## Losses are part of the process
No trader wins every trade. Even skilled traders have long losing streaks. What matters is controlling how much you can lose on each trade (GFX standard: max 1% of your account) and keeping your losses small and planned. A trader who risks too much can lose their account in a few bad trades.
Sa Taglish: Kahit skilled traders may losing streaks. I-control ang talo per trade, max 1% ng account, para hindi maubos ang account sa ilang bad trades.

## Costs reduce results
Every trade has costs such as the spread and sometimes commissions or overnight (swap) fees. These costs mean a trade has to move in your favor just to break even.
Sa Taglish: Spread, commission at swap fees ay costs, kaya kailangang gumalaw muna in your favor ang trade para lang mag-break even.

## The honest picture
Many retail traders lose money, especially when using leverage. GFX does not promise profits. The goal of this Academy is to help you understand the market, build a plan, and protect your capital while you learn, starting small with money you can afford to lose.
Sa Taglish: Maraming retail traders ang nalulugi, lalo na with leverage. Walang profit promise ang GFX; ang focus ay understanding, plan at protecting your capital, start small.

## Why risk per trade matters more than wins
Imagine two hypothetical traders. One risks 1% of their account per trade; after five losses in a row they are down about 5% and can keep learning. The other risks 20% per trade; after the same five losses they have lost most of their account. Same market, same bad luck, very different outcome. Small, consistent risk keeps you in the game long enough to improve.
Sa Taglish: After 5 losses in a row: sa 1% risk, down lang ng about 5%; sa 20% risk, halos ubos na ang account. Small, consistent risk keeps you in the game.

## Process over profit
As a beginner, judge yourself by whether you followed your plan: did every trade have a stop loss, was the size within 1%, did you journal it? These are things you control. Outcomes of single trades are partly luck and are not a good measure of skill.
Sa Taglish: I-judge ang sarili mo kung nasunod mo ang plan: may stop loss, within 1%, naka-journal. Partly luck ang result ng isang trade.

## Quick recap
Trades can gain or lose in either direction, costs apply to every trade, and losing streaks happen to everyone. Keep risk small and consistent, at max 1% per trade, with a stop loss on every trade.
Sa Taglish: Pwedeng manalo o matalo sa long o short, may costs lagi, at normal ang losing streaks. Max 1% per trade, laging may stop loss.

## Gold example (hypothetical): Long vs short on gold
• Hypothetical long: buy 0.01 lot (1 oz) XAUUSD at 2,350.00, stop loss at 2,345.00.
• If price rises to 2,355.00, the position is up $5.00 per oz = $5 (before costs).
• If price falls to the stop loss at 2,345.00, the position closes at a loss of $5.00 per oz = $5 (plus costs).
• Hypothetical short: sell 0.01 lot at 2,350.00; if price falls to 2,345.00 the position is up $5, if it rises to 2,355.00 it is down $5.
These are illustrative numbers before costs, not results. Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.
Sa Taglish: Sa 0.01 lot, ang $5 na galaw ay $5 na gain o $5 na loss (before costs), depende kung long o short ka at saan pumunta ang price.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["A long (buy) position gains when price rises; a short (sell) position gains when price falls, and either can lose.", "Losing trades are normal; controlling loss size (max 1% per trade) matters more than any single win.", "Costs like the spread mean a trade must move in your favor just to break even."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('0a66d41e-7255-4028-8640-caf4497a4adb'::uuid,
       $lrd_orig_20261115$This lesson shows the general steps to get started with ACCM, the broker used in the Academy's examples.

Disclosure: ACCM is GFX's partner broker. Education only, not financial advice.

Steps to get started:
1. Check the broker's licence for your country and the legal entity you would sign up with, on the regulator's own public register.
2. If you decide to trade, register a cents account (real money; balance shown in cents, very small lot sizes) through GFX's IB link, complete KYC (ID + selfie), and start small with money you can afford to lose. Minimum deposit: $50 (as of Oct 2026), via GCash, Maya, or other e-wallets; check ACCM's site for current terms. Max 1% risk per trade, stop-loss on every trade.
3. Optional: if you've never used MT5, you can open a free demo inside the MT5 app (no ACCM registration needed) just to learn the buttons before your first cents trade. It isn't required.

Sa Taglish: I-check muna ang licence ng broker para sa bansa mo. Kung magte-trade ka, cents account: real money pero maliit lang, pera lang na kaya mong mawala, max 1% risk, laging may stop-loss. Optional ang MT5 demo, para lang sa buttons.$lrd_orig_20261115$,
       $lrd_orig_20261115$["Check the broker's licence for your country before opening any account. The MT5 demo is optional, for learning the buttons.", "A cents account through the IB link is optional and uses real money: start small with money you can afford to lose, max 1% risk per trade, stop-loss on every trade.", "ACCM is GFX's partner broker."]$lrd_orig_20261115$::jsonb,
       '2026-11-01 17:53:57.943701+00'::timestamptz),
      ('a1caf3d9-689a-4696-9443-f9f947a1dd05'::uuid,
       $lrd_orig_20261115$Pips
A pip is the unit used to measure price change. In GFX lessons, for XAUUSD, a $0.01 move = 1 pip, so a $1.00 move = 100 pips. Many brokers instead call $0.10 one pip; the dollar math stays the same if you work in price moves.

Lots
Lot size is the size of your position. Common convention for gold: 1 standard lot = 100 oz, 0.10 lot (mini) = 10 oz, 0.01 lot (micro) = 1 oz. Value per $0.01 move: $1 for 1 lot, $0.10 for 0.10 lot, $0.01 for 0.01 lot. Equivalently, a $1.00 move = $100 per standard lot, $1 per micro lot.

Leverage
Leverage lets you control a position larger than your deposit; the broker requires only a portion as margin. Leverage does not change how much each price move is worth; it only changes how much margin is held. It makes it easy to open positions far too large for your account, which magnifies losses as much as gains.

Sizing from risk, not from leverage
Decide your maximum loss first (GFX standard: max 1% of your account), set your stop loss at a logical level, then calculate the lot size that fits. Never pick a lot size because leverage allows it.

Margin in simple terms
Margin is the amount the broker sets aside from your balance to keep a position open. With 1:100 leverage, a hypothetical 0.01 lot of gold at 2,350.00 (value about $2,350) would need roughly $23.50 in margin. Low margin requirements don't make a trade safer; your risk is still decided by your stop distance and position size. If losses reduce your free margin too far, the broker may close positions automatically (a margin call or stop-out).

Quick recap
Pips measure price movement, lots measure position size, and leverage only affects margin. To size a trade: choose your stop level, measure the distance, calculate the loss per 0.01 lot, then divide your 1% risk amount by that number and round down.

Gold example (hypothetical): Sizing a gold trade with 1% risk
Halimbawa lang / example only.
• Hypothetical account: $1,000. Max risk 1% = $10.
• Plan: buy XAUUSD at 2,350.00 with stop loss at 2,345.00 → stop distance $5.00 (500 pips at $0.01 = 1 pip).
• Loss per 0.01 lot (1 oz) if stopped = $5.00 × 1 = $5.
• Lot size = $10 ÷ $5 per 0.01 lot = 0.02 lot (2 oz).
• Check: $5.00 × 2 oz = $10 = 1% of the account. A 1-lot position would risk $500 (50% of the account), which leverage might allow but your risk rule never should.
Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.

Taglish summary
Pip = sukat ng galaw ng presyo (sa GFX lessons, $0.01 = 1 pip sa Gold). Lot = laki ng position: 1 lot = 100 oz, 0.01 lot = 1 oz. Ang leverage ay nagpapalaki ng position na kaya mong buksan, kaya delikado. Tamang proseso: unahin ang 1% max risk, ilagay ang stop loss, saka i-compute ang lot size. Hindi dahil kaya ng leverage.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["In the common convention, 1 standard lot of gold = 100 oz, and a $0.01 move = $1 per lot; check your broker's specs.", "Leverage changes margin, not the value of each move, and it makes oversized positions dangerously easy.", "Size every trade from max 1% risk and your stop distance, never from available leverage."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('5b957c8d-5ac5-45ee-bcbf-5bc7ec91d764'::uuid,
       $lrd_orig_20261115$Demo = virtual money, zero emotional pressure. Real money, even small amounts, brings fear, greed and the urge to 'bawi' after a loss.

The Psychological Gap: Many traders do well on demo, then struggle once real money is involved. Real money triggers fear and greed at a level demo never can. That's why GFX suggests learning with small real money instead of building habits on virtual money.

Start small: the cents account
A cents account is a real-money account whose balance is shown in cents (for example, a $10 deposit shows as 1,000) and that allows very small lot sizes, so you can feel real-money emotions with tiny amounts. Not every broker offers one. Use only money you can afford to lose; max 1% risk per trade, stop-loss on every trade. Losses are still real, and results are not guaranteed.

Sa Taglish: Iba ang feeling kapag real money na. Kaya start small sa cents account, para ma-train mo ang emotions mo habang maliit ang taya. Max 1% risk, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["The buttons are the same on demo and real accounts; the psychological weight of real money is what changes everything.", "Positive results on demo don't guarantee the same results with real money.", "Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('5698278e-2b5c-4706-8032-50cd517df741'::uuid,
       $lrd_orig_20261115$## TL;DR sa Taglish
Stocks = share sa isang company. Forex = trading ng isang currency against another, like USD vs PHP. Gold (XAUUSD) = price ng gold in US dollars. Gumagalaw ang gold dahil sa fear, inflation, interest rates at lakas ng US dollar, at minsan sobrang bilis, lalo na sa big US news. Kaya smaller lot muna, laging may stop loss, at iwas muna sa big news habang nag-aaral ka pa.
Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.

## Three common markets
Stocks are shares of ownership in a company; their prices react to company results and the wider economy. Forex (foreign exchange) is the trading of one currency against another, for example USD against PHP. Gold is a commodity; XAUUSD is gold priced in US dollars and is usually traded on forex-style platforms.
Sa Taglish: Stocks follow ang company results, forex ay currency vs currency, at ang gold ay commodity na usually tine-trade sa forex-style platforms.

## What moves gold
Gold often reacts to: fear and uncertainty (some investors buy gold as a perceived safe haven), inflation expectations, interest-rate expectations, and the strength of the US dollar. Major US economic releases (like inflation or jobs data) can cause sharp, fast moves within minutes.
Sa Taglish: Fear, inflation, interest rates at ang US dollar ang madalas nagpapagalaw sa gold, at ang big US news pwedeng magpa-spike ng price within minutes.

## Why gold is popular, and why it needs care
Gold is very liquid and trades nearly around the clock on weekdays, which makes it accessible. But it can also move quickly and widely. That speed cuts both ways: losses can grow as fast as gains. For beginners that means smaller position sizes, a stop loss on every trade, and avoiding trading right at big news releases while you are still learning.
Sa Taglish: Liquid ang gold at open halos buong weekdays, pero mabilis gumalaw: kasing-bilis ng gains ang losses. Kaya small size, laging may stop loss, at iwas muna sa big news.

## Comparing them simply
Stocks: tied to company performance, trade during exchange hours. Forex: tied to economies and interest rates, trades 24/5. Gold: tied to fear, inflation, rates and the dollar, trades nearly 24/5 and is often more volatile than major currency pairs.
Sa Taglish: Stocks = company at exchange hours; forex = economies at 24/5; gold = fear, inflation, rates at dollar, halos 24/5 at madalas mas volatile.

## What you actually trade on a platform
Most retail gold trading happens through contracts (often CFDs) that follow the gold price. You don't receive physical gold; you gain or lose based on how the price moves while your position is open. This makes it easy to go long or short, but it also means leverage and costs apply, so the same risk rules matter here as in any market.
Sa Taglish: Usually CFD ang tine-trade mo, hindi physical gold. Pwede kang long o short, pero may leverage at costs, kaya same risk rules pa rin.

## Before you trade any market
Whichever market you choose, the basics don't change: understand what moves it, know its trading hours and typical volatility, check all costs, and size every position so that a loss stays within 1% of your account. For now, focus on one market, gold, and learn it well, starting small, before adding anything else.
Sa Taglish: Alamin kung ano ang nagpapagalaw, ang trading hours at costs, at i-size ang bawat trade para max 1% lang ang talo. Focus muna sa gold, at start small.

## Gold example (hypothetical): How a news spike can look
• Hypothetical: XAUUSD is at 2,340.00 a few minutes before a US inflation report.
• The report surprises the market and gold jumps to 2,352.00 within minutes, a $12.00 move.
• On 1 standard lot (100 oz), a $12.00 move equals $1,200; on 0.01 lot (1 oz), it equals $12.
• The same move in the opposite direction would be a loss of the same size, which is why position size and a stop loss matter.
Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.
Sa Taglish: Ang $12 na galaw ay $1,200 sa 1 standard lot pero $12 lang sa 0.01 lot, at ganoon din kalaki ang talo kung pabaliktad. Kaya mahalaga ang size at stop loss.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["Stocks follow companies, forex follows currencies and economies, and gold follows fear, inflation, rates and the US dollar.", "Gold is liquid and trades almost 24/5, but it can move very fast, especially around major US news.", "Fast markets require smaller positions, a stop loss on every trade, and starting small."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('c7eaf0f2-c415-4b9a-97c9-84f0095a721a'::uuid,
       $lrd_orig_20261115$Market order
Executes immediately at the best available price. Buy orders fill at the ask, sell orders at the bid. In fast markets, the fill can differ slightly from what you saw (slippage).

Pending orders
Buy limit: buy below the current price (expecting a pullback). Sell limit: sell above the current price. Buy stop: buy above the current price (expecting a breakout). Sell stop: sell below the current price.

Stop loss and take profit
A stop loss (SL) automatically closes a trade at a set loss level; a take profit (TP) closes it at a set target. GFX rule: every trade has a stop loss attached when it is placed. Note that in fast or gapping markets a stop can fill worse than its level.

Practice
Learn each order type until you can place it correctly without thinking: right direction, right size, SL attached. Optional: rehearse the buttons on a free MT5 demo beforehand; on a real account, use the smallest size.

Order checklist before you click
1. Direction: buy or sell, matching your plan. 2. Size: calculated from max 1% risk and your stop distance. 3. Stop loss: set at a logical level, entered in the order. 4. Take profit or exit plan: written down. 5. Spread and news: check the current spread and the economic calendar. Reading this checklist every time feels slow at first, but it prevents the most common beginner errors, like a wrong direction or a missing stop.

Managing open trades
Once a trade is open, avoid moving your stop loss further away to 'give it room'; that increases your risk beyond plan. Many traders only allow themselves to move a stop in the direction that reduces risk. Pending orders that are no longer valid, for example after the market situation changes, should be cancelled so they don't fill unexpectedly.

Quick recap
Market orders fill now, limit orders wait for a better price, and stop orders wait for a breakout. Whichever you choose, the stop loss goes in with the order, and the size comes from your 1% rule.

Gold example (hypothetical): Placing a buy limit with SL and TP
Halimbawa lang / example only.
• Hypothetical: XAUUSD at 2,350.00; your plan wants to buy a pullback to 2,345.00.
• Order: buy limit at 2,345.00, stop loss 2,340.00 ($5.00 risk per oz), take profit 2,355.00 ($10.00 target per oz).
• Size from 1% risk on a hypothetical $1,000 account: $10 ÷ $5 = 0.02 lot (2 oz).
• If filled and stopped: −$10 (1%). If target hit: +$20 before costs. Illustrative only, not a result.
Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.

Taglish summary
Market order = pasok agad sa current price. Pending orders: buy limit/sell limit (hintayin ang mas magandang presyo), buy stop/sell stop (pasok kapag na-break ang level). Pinakamahalaga: laging may stop loss na naka-attach pagka-place pa lang ng order. Optional: i-try muna ang buttons sa MT5 demo hanggang kabisado mo na.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["Market orders fill immediately; limit and stop orders wait for a specific price.", "Attach a stop loss to every trade when you place it; a take profit is optional but planned.", "Fast markets can cause slippage, so know every order type before you use it, and start with the smallest size."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('b123eaf2-b4fa-4ef0-8a07-bdaa190a3286'::uuid,
       $lrd_orig_20261115$What a broker does
A broker gives you access to the market through a trading platform (such as MetaTrader 5). You deposit funds with the broker, and it executes your orders and shows you prices.

How brokers earn
Brokers typically earn from spreads, commissions, and overnight (swap) fees. Some brokers may also take the other side of client trades. Understanding this helps you look at costs and conflicts of interest clearly.

How to evaluate a broker
Check: (1) regulation, look up the license number directly on the regulator's own website, not just the broker's claims; (2) clear costs: spreads, commissions, swaps, deposit and withdrawal fees; (3) withdrawal process and reputation; (4) negative balance protection; (5) whether they offer a cents account (small real-money account) and a free MT5 demo for learning the app; (6) the legal entity you'd actually be a client of, since many brokers operate several entities with different protections.

Red flags
Guaranteed returns, pressure to deposit quickly, 'account managers' who trade for you, bonuses with withdrawal conditions, and anyone asking for your login. If something promises easy profit, walk away.

Disclosure
GFX Society does not recommend a specific broker in this lesson. If GFX ever mentions a broker elsewhere, it must clearly disclose any affiliate or Introducing Broker (IB) relationship. Always do your own checks.

Platform vs broker
The trading platform (for example MetaTrader 5) is software; the broker is the company holding your money and handling your orders. The same platform can be offered by many different brokers with very different rules, costs and protections. Always check who the broker is, not just which platform it uses.

Fees and withdrawals in practice
Before depositing, find the full fee list and read it. Look for deposit and withdrawal fees, inactivity fees, currency conversion costs and minimum withdrawal amounts. Test the process with a small withdrawal early on. A broker that makes withdrawals slow or confusing is a warning sign, whatever its spreads look like.

Quick recap
Brokers provide access and earn from your trading costs. Verify regulation directly with the regulator, understand every fee, start small with money you can afford to lose, and never trust promises of guaranteed returns.

Gold example (hypothetical): Comparing costs between two hypothetical brokers
• Broker A (hypothetical): spread $0.30 on XAUUSD, no commission.
• Broker B (hypothetical): spread $0.10, plus $7 commission per standard lot round trip.
• For 1 standard lot (100 oz): A costs $0.30 × 100 = $30; B costs $0.10 × 100 + $7 = $17.
• For 0.01 lot (1 oz): A costs $0.30; B costs $0.10 + $0.07 = $0.17.
• Cost is only one factor. Regulation, withdrawals and protections matter more.
Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.

Taglish summary
Ang broker ang nagbibigay ng access sa market gamit ang platform. Kumikita sila sa spread, commission, at swap. Bago pumili, i-verify ang regulation sa mismong website ng regulator, alamin ang lahat ng fees, at i-check kung may cents account sila. Red flags: guaranteed profit, pressure mag-deposit, o may 'magte-trade para sa'yo'. Walang ini-endorse na broker ang lesson na 'to.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["A broker provides market access and earns through spreads, commissions and swaps.", "Verify regulation on the regulator's own website and understand every cost before depositing.", "Walk away from guaranteed returns, deposit pressure, or anyone offering to trade for you."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('3ea5a6f7-d454-4734-8a8a-af15f8c0adca'::uuid,
       $lrd_orig_20261115$## TL;DR sa Taglish
Bid = price kung magse-sell ka, ask = price kung magbu-buy ka. Ang difference nila ay ang spread, at cost mo agad iyan pagpasok mo ng trade. Lumalaki ang spread sa big news, sa daily rollover at kapag mababa ang liquidity. Bago pumasok, i-check ang spread at bigyan ng buffer ang stop loss mo. Makikita mo ang live spread sa MT5 kahit hindi ka nagte-trade.
Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.

## Bid and ask
Every platform shows two prices. The bid is the price at which you can sell; the ask is the price at which you can buy. The ask is higher than the bid.
Sa Taglish: Dalawang price ang makikita mo: bid para mag-sell, ask para mag-buy, at laging mas mataas ang ask.

## The spread
The spread is the difference between ask and bid. It is a trading cost: as soon as you open a trade, you start slightly negative because you bought at the ask but could only sell back at the bid.
Sa Taglish: Ask minus bid = spread. Pagpasok mo, slightly negative ka agad dahil sa cost na ito.

## Spreads change
Spreads vary between providers, account types and times of day. They often widen during major news, at the daily market rollover, and when liquidity is low (for example around the weekly open). Wider spreads mean higher cost and can trigger a tight stop loss unexpectedly.
Sa Taglish: Iba-iba ang spread per provider, account at oras. Lumalaki ito sa news, rollover at low liquidity, at pwedeng ma-trigger ang tight stop loss.

## What to do as a beginner
Check the live spread before entering. Avoid trading when spreads are unusually wide. When placing a stop loss, leave room for the spread. Compare spreads on the account type you will actually use (for example, a cents account) before you trade, and judge any provider on regulation and transparency, not just low spreads.
Sa Taglish: I-check ang live spread, iwas sa sobrang lapad na spread, at bigyan ng room ang stop loss. Piliin ang provider base sa regulation at transparency, hindi lang low spread.

## Other trading costs
Besides the spread, some accounts charge a commission per lot, and positions held overnight usually pay or receive a swap (financing) fee. Gold swaps can be significant for long-held positions. Add all costs together when you compare accounts, and remember that frequent trading multiplies costs.
Sa Taglish: Bukod sa spread, may commission per lot at swap fee kapag overnight ang position. Pwedeng malaki ang gold swaps, at mas maraming trades = mas maraming costs.

## Spread and your stop loss
Charts usually display the bid price. If you buy, your stop loss is triggered by the bid; if you sell, it is triggered by the ask. That means when spreads widen suddenly, a short position's stop can be hit even if the bid chart never touched your level. Leaving a small buffer and avoiding trading around big news helps reduce these surprises.
Sa Taglish: Bid ang usual na nasa chart. Sa buy, bid ang tumatama sa stop mo; sa sell, ask, kaya pwedeng ma-hit ang short stop kahit hindi umabot ang bid chart. Mag-iwan ng buffer.

## Quick recap
The spread is the gap between buy and sell prices and a cost on every trade. Check it before entering, expect it to widen around news, and leave a buffer for it when placing your stop loss.
Sa Taglish: Ang spread ay gap ng buy at sell price at cost sa bawat trade. I-check bago pumasok, expect na lalaki ito sa news, at mag-buffer sa stop loss.

## Gold example (hypothetical): Calculating the spread cost
• Hypothetical quote: Bid 2,350.00 / Ask 2,350.30.
• Spread = 2,350.30 − 2,350.00 = $0.30 = 30 pips (with $0.01 = 1 pip).
• On 1 standard lot (100 oz): $0.30 × 100 = $30 cost to open.
• On 0.01 lot (1 oz): $0.30 × 1 = $0.30 cost.
• Price must rise $0.30 from your buy just for the trade to break even (before other costs).
Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.
Sa Taglish: Ang spread na $0.30 ay $30 sa 1 standard lot at $0.30 sa 0.01 lot, at kailangang tumaas ng $0.30 ang price para lang mag-break even.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["Bid is the sell price, ask is the buy price, and the spread is the difference: a cost on every trade.", "Spreads vary and often widen around news, rollover and low liquidity.", "Check the spread before entering and leave room for it when placing your stop loss."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz),
      ('680c3ddf-a5e5-459d-bdf3-e8f06251e1de'::uuid,
       $lrd_orig_20261115$## TL;DR sa Taglish
Ang financial market ay kung saan nagba-buy and sell ng shares, currencies at commodities like Gold, mostly online. Gumagalaw ang price depende sa dami ng buyers vs sellers. XAUUSD = price ng 1 troy ounce ng Gold in US dollars. Bilang beginner, hindi mo job ang mag-predict; ang goal mo ay matuto at mag-manage ng risk.
Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.

## A marketplace for prices
A financial market is any place, physical or electronic, where buyers and sellers exchange assets such as company shares, currencies, commodities like gold, and bonds. Today almost all of this happens electronically. Prices move because the balance between buyers and sellers keeps changing: when more people want to buy than sell, the price tends to rise; when more want to sell, it tends to fall.
Sa Taglish: Ang market ay bilihan at bentahan. Mas maraming buyer, tumataas ang presyo; mas maraming seller, bumababa.

## Who participates
Participants include central banks, commercial banks, funds, companies that need foreign currency or raw materials, and individual (retail) traders. Retail traders are a small part of the market. Large institutions move prices far more than any individual, which is one reason no one can reliably predict short-term moves.
Sa Taglish: Malalaking bangko at funds ang pinakanagpapagalaw ng presyo, kaya walang makakahula nang sigurado sa maikling galaw.

## Where gold fits
Gold is traded worldwide as a commodity and as a store of value. When you see XAUUSD, it means the price of one troy ounce of gold in US dollars. Gold trades almost 24 hours a day, five days a week, because different financial centers (Asia, Europe, the US) open one after another.
Sa Taglish: XAUUSD = presyo ng 1 troy ounce ng gold sa US dollars. Halos 24 oras ito nagte-trade, Lunes hanggang Biyernes.

## Why this matters for you
Understanding that prices come from millions of decisions helps you stay humble: your job as a beginner is not to predict, but to learn how markets work and manage risk. If you trade, start small, with money you can afford to lose.
Sa Taglish: Hindi mo trabaho mang-hula. Matuto, mag-manage ng risk, at kung magte-trade ka, start small.

## Exchanges vs over-the-counter
Some markets run on central exchanges, like a stock exchange, where all orders meet in one place. Others, like forex and most gold trading for retail traders, are over-the-counter (OTC): prices come from a network of banks and liquidity providers, and your platform shows you a price based on that network. This is why the gold price you see can differ very slightly from one platform to another.
Sa Taglish: Karaniwang OTC ang gold, kaya pwedeng bahagyang magkaiba ang presyo sa bawat platform.

## Key words to know
Asset: anything that can be bought or sold, such as gold. Liquidity: how easily an asset can be bought or sold without moving the price much; gold is highly liquid. Volatility: how much and how fast the price moves; gold can be quite volatile. You will meet these words again in every level, so take a moment to make sure they feel familiar before moving on.
Sa Taglish: Asset = bagay na binibili o binebenta. Liquidity = gaano kadaling bumili o magbenta. Volatility = gaano kabilis at kalaki gumalaw ang presyo.

## Gold example (hypothetical): Reading a gold price
• Suppose your platform shows XAUUSD at 2,350.00 (hypothetical).
• That means 1 troy ounce of gold costs 2,350.00 US dollars at that moment.
• If news makes more buyers step in and the price moves to 2,352.00, gold has risen by $2.00 per ounce.
• If sellers dominate and it drops to 2,348.00, gold has fallen by $2.00 per ounce.
The same $2 move can be a small or large gain or loss depending on position size, which you'll learn in Level 2.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.
Sa Taglish: Ang $2 na galaw ay pwedeng maliit o malaking gain o loss, depende sa laki ng position mo.

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$lrd_orig_20261115$,
       $lrd_orig_20261115$["A financial market is where buyers and sellers exchange assets; prices move with the balance of supply and demand.", "XAUUSD is the price of one troy ounce of gold in US dollars, traded almost 24 hours a day, 5 days a week.", "Large institutions drive most price movement, so beginners should focus on learning and risk control, not prediction."]$lrd_orig_20261115$::jsonb,
       '2026-10-18 05:44:40.688404+00'::timestamptz)
    ) as o(id, content, key_takeaways, updated_at)
  where l.id = e.id and o.id = e.id
    and l.level_id = e.level_id and l.slug = e.slug
    and md5(l.content) = e.after_content_md5 and md5(l.key_takeaways::text) = e.after_tk_md5;
  get diagnostics n_upd = row_count;
  if n_upd <> 13 then raise exception 'lesson-risk-dedupe revert ABORTED (rolled back): updated % rows, expected 13', n_upd; end if;

  select count(*) into n_before
  from jsonb_to_recordset(m) as e(id uuid, level_id uuid, slug text, before_content_md5 text, before_tk_md5 text, after_content_md5 text, after_tk_md5 text)
  join public.lessons l on l.id = e.id
  where md5(l.content) = e.before_content_md5 and md5(l.key_takeaways::text) = e.before_tk_md5;
  if n_before <> 13 then raise exception 'lesson-risk-dedupe revert ABORTED (rolled back): only % of 13 rows match the original md5', n_before; end if;

  raise notice 'lesson-risk-dedupe revert: 13 rows restored (content, key_takeaways, updated_at) and verified against the original md5s.';
end
$lrd_revert$;

commit;
