-- Cents-account pivot: lesson, diagnostic and level copy (spec: /workspace/gfx/design/cents-pivot-spec.md,
-- rows L1-L94, G1-G4, D1-D14, V1-V3; Ben's decisions 18 Oct 2026). Renames 2 lesson slugs (ids kept,
-- so progress/quiz attempts/analytics are kept); the app ships matching 301 redirects.
--
-- Guarded + idempotent: every UPDATE matches only while the touched columns still have today's live
-- md5 (read-only export 18 Oct 2026). A second run updates 0 rows and raises nothing.
-- No correctIndex / correct_index changes. NOT APPLIED. Sorts after every recorded version
-- (latest 20261011163101) and after all repo migration files.
-- Rollback reference: supabase/snapshots/20261018_cents_pivot_pre.json (pre-change rows).

begin;

-- backtesting-your-strategy
update public.lessons set
  interactive_config = $q${"scenarios": [{"chart": [{"c": 51, "h": 54, "l": 30, "o": 52}], "options": ["Enter — this matches the rule", "Skip — doesn't match", "Wait for a different pattern", "Double the position size"], "question": "Your rule is \"buy on a bullish pin bar at support.\" This candle formed right at support (see chart). What do you do?", "explanation": "A backtest only works if you follow your own rule consistently — this is a textbook match.", "correctIndex": 0}, {"chart": [{"c": 42, "h": 45, "l": 38, "o": 41}], "options": ["Skip — no signal here", "Enter anyway, it looks bullish", "Enter with a smaller size", "Change your rule on the spot"], "question": "This candle formed in the middle of a range, not at any support or resistance zone (see chart). Your rule is \"buy on a bullish pin bar at support.\" What do you do?", "explanation": "Skipping trades that don't match your rule is just as important as taking the ones that do — that discipline is what backtesting builds.", "correctIndex": 0}, {"chart": [{"c": 49, "h": 70, "l": 46, "o": 48}], "options": ["Skip — wrong signal type for this system", "Enter — it's still a reversal pattern", "Enter but reverse the direction", "Skip the whole session"], "question": "This is a shooting star at resistance (see chart). Your rule is \"buy on a bullish pin bar at support.\" What do you do?", "explanation": "A shooting star at resistance is a bearish signal — it doesn't match a buy-only rule, even though it's a valid pattern.", "correctIndex": 0}, {"icon": "📈", "options": ["A positive expectancy in the test — worth trying small next, max 1% risk (not guaranteed)", "No — below 50% win rate means it loses", "Cannot tell without more data", "Only if you increase the RR further"], "question": "Your backtest shows a 42% win rate at 1:2 RR over 100 trades. What does this backtest suggest?", "explanation": "42% win rate at 1:2 RR: 42 wins x 2R = 84R, 58 losses x 1R = 58R. Net = +26R over those 100 test trades: a positive expectancy even under a 50% win rate, but not a guarantee of future results. If you try it, start small on a cents account with max 1% risk and a stop loss on every trade.", "correctIndex": 0}, {"icon": "🔬", "options": ["Test whether your rules showed an edge on historical data, without risking real money", "Guarantee your strategy will win in the future", "Make trading feel more exciting", "Copy what other traders are doing"], "question": "The main point of backtesting before you risk real money is to:", "explanation": "Backtesting doesn't guarantee future results, but it tells you whether your rules had any edge at all before you risk real capital on them.", "correctIndex": 0}]}$q$::jsonb,
  updated_at = now()
where id = 'd0f2dc2d-bad5-4b7e-9bbb-6a9efd672d65'
  and md5(coalesce(interactive_config::text,'')) = '0abc97b1164eecc37c0e83bcdfbe419a';

-- pips-lots-and-leverage
update public.lessons set
  content = $q$Pips
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  examples = $q$[{"note": "Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.", "steps": ["Halimbawa lang / example only.", "Hypothetical account: $1,000. Max risk 1% = $10.", "Plan: buy XAUUSD at 2,350.00 with stop loss at 2,345.00 → stop distance $5.00 (500 pips at $0.01 = 1 pip).", "Loss per 0.01 lot (1 oz) if stopped = $5.00 × 1 = $5.", "Lot size = $10 ÷ $5 per 0.01 lot = 0.02 lot (2 oz).", "Check: $5.00 × 2 oz = $10 = 1% of the account. A 1-lot position would risk $500 (50% of the account), which leverage might allow but your risk rule never should."], "title": "Sizing a gold trade with 1% risk", "disclaimer": "All prices are illustrative and hypothetical, not real quotes, forecasts, or results.", "hypothetical": true}]$q$::jsonb,
  updated_at = now()
where id = 'a1caf3d9-689a-4696-9443-f9f947a1dd05'
  and md5(coalesce(content,'')) = '1c15c6f12c03528b97af712e5c78f0bf'
  and md5(coalesce(examples::text,'')) = 'cfb1b89f8c202758a751cd27f1a06c47';

-- candlestick-anatomy
update public.lessons set
  content = $q$What a candle shows
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  updated_at = now()
where id = 'd7926520-c96b-4d61-bd1e-0078b3b718a8'
  and md5(coalesce(content,'')) = 'b7cf7e8dcab1def3efd3e4881a2d65d1';

-- stocks-vs-forex-vs-gold
update public.lessons set
  content = $q$## TL;DR sa Taglish
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  key_takeaways = $q$["Stocks follow companies, forex follows currencies and economies, and gold follows fear, inflation, rates and the US dollar.", "Gold is liquid and trades almost 24/5, but it can move very fast, especially around major US news.", "Fast markets require smaller positions, a stop loss on every trade, and starting small."]$q$::jsonb,
  interactive_config = $q${"scenarios": [{"options": ["A company's quarterly earnings", "Inflation and interest-rate expectations", "The number of followers a trader has", "The color of the chart"], "question": "Which factor commonly moves the gold price?", "explanation": "Gold often reacts to inflation, interest-rate expectations, risk sentiment and the US dollar.", "correctIndex": 1}, {"options": ["$0.12", "$1.20", "$12", "$1,200"], "question": "Hypothetically, gold moves $12.00. What is the change on 0.01 lot (1 oz)?", "explanation": "0.01 lot = 1 oz in the common convention, so a $12.00 move changes the position by $12. (Conventions vary by broker.)", "correctIndex": 2}, {"options": ["Use a large lot to catch big moves", "Trade every news release", "Use small positions, always a stop loss, and start small", "Remove the stop loss so you aren't stopped out"], "question": "What is a sensible beginner approach to a fast market like gold?", "explanation": "Speed means losses can grow quickly. Small size, a stop loss on every trade, and max 1% risk are the sensible starting point.", "correctIndex": 2}]}$q$::jsonb,
  updated_at = now()
where id = '5698278e-2b5c-4706-8032-50cd517df741'
  and md5(coalesce(content,'')) = 'e6128ae9f482de66481ad6ea5ea3e6c1'
  and md5(coalesce(key_takeaways::text,'')) = '19eddb30da848705b1c7c78e98860509'
  and md5(coalesce(interactive_config::text,'')) = 'c375fc15e99a9f29527b4d5f0698ae25';

-- bull-market-vs-bear-market
update public.lessons set
  content = $q$## TL;DR sa Taglish
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  updated_at = now()
where id = 'ad3d52a1-544d-47e0-91d9-337503678387'
  and md5(coalesce(content,'')) = '915b0e612df339e928739045813d0f8c';

-- position-sizing-and-lot-calculation
update public.lessons set
  interactive_config = $q${"scenarios": [{"options": ["$2", "$20", "$200", "$1,000"], "question": "Hypothetical: your account is $2,000. Under the GFX 1% rule, what is the most you may risk on one trade?", "explanation": "1% of $2,000 = $20. That is the maximum planned loss if your stop loss is hit.", "correctIndex": 1}, {"options": ["$0.65 (65 pips)", "$6.50 (650 pips)", "$65.00 (6,500 pips)", "$3.50 (350 pips)"], "question": "Hypothetical: you plan to buy XAUUSD at 2,350.00 with a stop loss at 2,343.50. What is the stop distance?", "explanation": "2,350.00 − 2,343.50 = $6.50. With $0.01 = 1 pip, that is 650 pips. (Many brokers count a gold pip as $0.10, which would make it 65 pips; the dollar distance is the same.)", "correctIndex": 1}, {"options": ["0.03 lot", "0.04 lot", "0.30 lot", "3 lots"], "question": "Same trade: $20 max risk, $6.50 stop distance. With 1 lot = 100 oz (so 0.01 lot = 1 oz and a $0.01 move = $1 per lot), what is the largest lot size within the rule, in 0.01-lot steps?", "explanation": "Loss per 0.01 lot = $6.50 × 1 oz = $6.50. $20 ÷ $6.50 ≈ 3.08 → round DOWN to 3 × 0.01 = 0.03 lot (risk $19.50). 0.04 lot would risk $26, which is over 1%.", "correctIndex": 0}]}$q$::jsonb,
  updated_at = now()
where id = '7246c3d7-a7bb-4945-9c40-9758b4cbd553'
  and md5(coalesce(interactive_config::text,'')) = 'd66c105b56662a2111ef3ff72d6869e0';

-- what-is-the-financial-market
update public.lessons set
  content = $q$## TL;DR sa Taglish
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  interactive_config = $q${"scenarios": [{"options": ["The price of 1 gram of gold in Philippine pesos", "The price of 1 troy ounce of gold in US dollars", "A gold mining company's stock", "The exchange rate between USD and EUR"], "question": "What does XAUUSD represent?", "explanation": "XAU is the code for gold and USD for the US dollar, so XAUUSD is the price of one troy ounce of gold in dollars.", "correctIndex": 1}, {"options": ["Because the broker decides to raise it", "Because more participants want to buy than sell", "Because it is a weekday", "Because retail traders always buy"], "question": "Why does a market price usually rise?", "explanation": "Prices move with supply and demand. More buying pressure than selling pressure tends to push prices up.", "correctIndex": 1}, {"options": ["Predicting tomorrow's gold price", "Copying other people's trades", "Learning how the market works and managing risk", "Trading with as much money as possible"], "question": "What is the best focus for a beginner?", "explanation": "No one reliably predicts short-term moves. Beginners should learn the basics and manage risk: max 1% per trade, a stop loss on every trade.", "correctIndex": 2}]}$q$::jsonb,
  updated_at = now()
where id = '680c3ddf-a5e5-459d-bdf3-e8f06251e1de'
  and md5(coalesce(content,'')) = '27ae186c2651ae4f088817e89a3c4360'
  and md5(coalesce(interactive_config::text,'')) = '94017957e3dc3c297bce1276e57b1a9c';

-- demo-vs-live-account
update public.lessons set
  slug = $q$real-money-and-your-emotions$q$,
  title = $q$Real Money and Your Emotions$q$,
  learning_objective = $q$Understand why real money changes your psychology, why demo results don't transfer, and how a small cents account helps you train your emotions.$q$,
  content = $q$Demo = virtual money, zero emotional pressure. Real money, even small amounts, brings fear, greed and the urge to 'bawi' after a loss.

The Psychological Gap: Many traders do well on demo, then struggle once real money is involved. Real money triggers fear and greed at a level demo never can. That's why GFX suggests learning with small real money instead of building habits on virtual money.

Start small: the cents account
A cents account is a real-money account whose balance is shown in cents (for example, a $10 deposit shows as 1,000) and that allows very small lot sizes, so you can feel real-money emotions with tiny amounts. Not every broker offers one. Use only money you can afford to lose; max 1% risk per trade, stop-loss on every trade. Losses are still real, and results are not guaranteed.

Sa Taglish: Iba ang feeling kapag real money na. Kaya start small sa cents account, para ma-train mo ang emotions mo habang maliit ang taya. Max 1% risk, laging may stop loss.$q$,
  key_takeaways = $q$["The buttons are the same on demo and real accounts; the psychological weight of real money is what changes everything.", "Positive results on demo don't guarantee the same results with real money.", "Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss."]$q$::jsonb,
  interactive_config = $q${"scenarios": [{"icon": "🧠", "options": ["Real money triggers emotions absent in demo", "Demo has better spreads", "Live execution is slower", "Demo has more indicators"], "question": "Why do traders often struggle more on live vs demo?", "explanation": "Real money triggers fear and greed at a level demo trading simply can't replicate.", "correctIndex": 0}, {"icon": "⚖️", "options": ["Real money brings real psychological pressure", "Live accounts have wider spreads by default", "Demo accounts always produce better results", "There is no real difference"], "question": "What's the main risk difference between demo and live trading?", "explanation": "The mechanics are identical — it's the psychological weight of real money that changes everything.", "correctIndex": 0}, {"icon": "🚧", "options": ["No — emotional factors on live are different", "Yes, demo results transfer directly", "Only if you use a bigger lot size live", "Yes, as long as you use the same broker"], "question": "Do positive results on demo guarantee the same results live?", "explanation": "Many traders do well on demo, then struggle with real money — which is why GFX suggests starting small with real money from the start.", "correctIndex": 0}]}$q$::jsonb,
  updated_at = now()
where id = '5b957c8d-5ac5-45ee-bcbf-5bc7ec91d764'
  and slug = 'demo-vs-live-account'
  and md5(coalesce(title,'')) = '4cae0274232cee952a767269da6356b7'
  and md5(coalesce(learning_objective,'')) = '745470ebc9f5ab2e2cd0b6fbb1255eb8'
  and md5(coalesce(content,'')) = '6010d4df0aa622af924b6003444706fe'
  and md5(coalesce(key_takeaways::text,'')) = 'd6c6ee91ff758516d624bffa5594530e'
  and md5(coalesce(interactive_config::text,'')) = '71af3ed6e9f70696bb08fc3997e9e3f8';

-- demo-account-your-practice-ground
update public.lessons set
  slug = $q$cents-account-your-first-real-money-practice$q$,
  title = $q$Cents Account — Your First Real-Money Practice$q$,
  learning_objective = $q$Understand what a cents account is, why GFX suggests starting small with real money to train your emotions, and the rules: max 1% risk per trade, stop loss on every trade.$q$,
  content = $q$What a cents account is
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  key_takeaways = $q$["A cents account is small real money: balance shown in cents, very small lot sizes, real losses.", "Practice stop losses, 1% sizing, your written plan and journaling on every trade, kahit maliit ang account.", "Measure progress by weeks of following your plan, not by your balance or profits.", "Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss."]$q$::jsonb,
  examples = $q$[{"note": "Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary, and cents accounts use different contract sizes. Always check your own broker's contract specifications.", "steps": ["Halimbawa lang / example only.", "Hypothetical $1,000 account. Rule: max 1% risk ($10) per trade, stop loss always.", "Trade idea: buy XAUUSD at 2,350.00, stop 2,346.00 ($4.00 per oz). Size = $10 ÷ $4 = 2.5 oz → round down to 0.02 lot (2 oz, $8 risk).", "Journal entry: reason for entry, SL/TP levels, size, result, and a yes/no: 'Did I follow my plan?'", "At week's end, count rule-following trades, not the balance."], "title": "A week-one routine", "disclaimer": "All prices are illustrative and hypothetical, not real quotes, forecasts, or results.", "hypothetical": true}]$q$::jsonb,
  interactive_config = $q${"scenarios": [{"options": ["Highest account balance", "Weeks of consistently following your plan", "Number of trades per day", "Biggest single win"], "question": "What is the best measure of progress on a cents account?", "explanation": "GFX measures readiness by process: weeks of following your rules, not profits.", "correctIndex": 1}, {"options": ["0.02 lot", "0.03 lot", "0.25 lot", "1 lot"], "question": "Hypothetical: $1,000 account, 1% risk, stop distance $4.00. Largest size within the rule (0.01-lot steps)?", "explanation": "$10 ÷ $4 per oz = 2.5 oz; round DOWN to 0.02 lot (2 oz = $8 risk). 0.03 lot would risk $12, over 1%.", "correctIndex": 0}, {"options": ["Cents accounts guarantee profits", "Small real money triggers the emotions you need to learn to manage", "Demo accounts have no charts", "There is no difference"], "question": "Why does GFX suggest a small cents account instead of only a demo?", "explanation": "Virtual money doesn't trigger fear or greed. Small real money does, so you can train your emotions while the amount at stake stays small. Losses are still real.", "correctIndex": 1}]}$q$::jsonb,
  updated_at = now()
where id = '3cb8acf1-27ac-42fb-bd4d-95e5b18b00ef'
  and slug = 'demo-account-your-practice-ground'
  and md5(coalesce(title,'')) = '5df31b7ca9d237e3ff5f7f99999cdebb'
  and md5(coalesce(learning_objective,'')) = '8333f0131ba3c7f51aaa2f585d42c322'
  and md5(coalesce(content,'')) = 'e206f4a084e3cc5ea689ebb63a07f734'
  and md5(coalesce(key_takeaways::text,'')) = '0849001fd023cb6b044318c7a15ae481'
  and md5(coalesce(examples::text,'')) = '5bbb5b4f1571b9d2b0b081f2932b2d33'
  and md5(coalesce(interactive_config::text,'')) = '8dfc682443590288eeb2a7e9a3110bc8';

-- opening-your-accm-account
update public.lessons set
  learning_objective = $q$Understand how to check a broker's licence for your country, open a cents account step by step, and where the optional MT5 demo fits.$q$,
  content = $q$This lesson shows the general steps to get started with ACCM, the broker used in the Academy's examples. You can use any broker you choose, or not trade at all.

Disclosure: GFX's founder is an Introducing Broker (IB) for ACCM. GFX may earn a commission from ACCM if you sign up through our link. You can use any broker you choose. Education only, not financial advice.

Steps to get started:
1. Check the broker's licence for your country and the legal entity you would sign up with, on the regulator's own public register.
2. If you decide to trade, register a cents account (real money; balance shown in cents, very small lot sizes) through GFX's IB link, complete KYC (ID + selfie), and start small with money you can afford to lose. Minimum deposit: $50 (as of Oct 2026), via GCash, Maya, or other e-wallets; check ACCM's site for current terms. Max 1% risk per trade, stop-loss on every trade.
3. Optional: if you've never used MT5, you can open a free demo inside the MT5 app (no ACCM registration needed) just to learn the buttons before your first cents trade. It isn't required.

Sa Taglish: I-check muna ang licence ng broker para sa bansa mo. Kung magte-trade ka, cents account: real money pero maliit lang, pera lang na kaya mong mawala, max 1% risk, laging may stop-loss. Optional ang MT5 demo, para lang sa buttons.$q$,
  key_takeaways = $q$["Check the broker's licence for your country before opening any account. The MT5 demo is optional, for learning the buttons.", "A cents account through the IB link is optional and uses real money: start small with money you can afford to lose, max 1% risk per trade, stop-loss on every trade.", "GFX's founder is an IB for ACCM. GFX may earn a commission from ACCM if you sign up through our link. You can use any broker you choose."]$q$::jsonb,
  updated_at = now()
where id = '0a66d41e-7255-4028-8640-caf4497a4adb'
  and md5(coalesce(learning_objective,'')) = '354a4ce73b14d8fb837b1fe2b9890604'
  and md5(coalesce(content,'')) = '8ff402abb8997fc42d0fed9c551ef5d7'
  and md5(coalesce(key_takeaways::text,'')) = '79d3694a31b2d1d702745d44188eeeac';

-- how-do-traders-make-money
update public.lessons set
  content = $q$## TL;DR sa Taglish
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  updated_at = now()
where id = '94768e3c-a60b-4fb3-be16-c2e5c5a30132'
  and md5(coalesce(content,'')) = '7a9e6f8d23063f772a3f85434ae91f03';

-- what-is-a-spread
update public.lessons set
  content = $q$## TL;DR sa Taglish
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  updated_at = now()
where id = '3ea5a6f7-d454-4734-8a8a-af15f8c0adca'
  and md5(coalesce(content,'')) = 'ad9ad4a52c458756c2a5bb2fe075c0c9';

-- what-is-a-broker
update public.lessons set
  content = $q$What a broker does
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  interactive_config = $q${"scenarios": [{"options": ["Trust the logo on their homepage", "Look up the license on the regulator's official website", "Ask in a comment section", "Check how many ads they run"], "question": "What is the safest way to check a broker's regulation?", "explanation": "Always verify the license directly with the regulator, since anyone can put a logo on a website.", "correctIndex": 1}, {"options": ["$7", "$10", "$17", "$70"], "question": "Hypothetically, Broker B charges a $0.10 spread plus $7 commission per standard lot. What is the cost for 1 standard lot?", "explanation": "$0.10 × 100 oz = $10 spread, plus $7 commission = $17.", "correctIndex": 2}, {"options": ["A cents account option", "Clear fee table", "A promise of guaranteed monthly returns", "Negative balance protection"], "question": "Which of these is a red flag?", "explanation": "No legitimate provider can guarantee returns. That is a major red flag.", "correctIndex": 2}]}$q$::jsonb,
  updated_at = now()
where id = 'b123eaf2-b4fa-4ef0-8a07-bdaa190a3286'
  and md5(coalesce(content,'')) = '73df65615460d1301024e87bbe71ce7f'
  and md5(coalesce(interactive_config::text,'')) = '3260074932969630995cb06f08a10c84';

-- types-of-orders
update public.lessons set
  content = $q$Market order
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  key_takeaways = $q$["Market orders fill immediately; limit and stop orders wait for a specific price.", "Attach a stop loss to every trade when you place it; a take profit is optional but planned.", "Fast markets can cause slippage, so know every order type before you use it, and start with the smallest size."]$q$::jsonb,
  examples = $q$[{"note": "Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.", "steps": ["Halimbawa lang / example only.", "Hypothetical: XAUUSD at 2,350.00; your plan wants to buy a pullback to 2,345.00.", "Order: buy limit at 2,345.00, stop loss 2,340.00 ($5.00 risk per oz), take profit 2,355.00 ($10.00 target per oz).", "Size from 1% risk on a hypothetical $1,000 account: $10 ÷ $5 = 0.02 lot (2 oz).", "If filled and stopped: −$10 (1%). If target hit: +$20 before costs. Illustrative only, not a result."], "title": "Placing a buy limit with SL and TP", "disclaimer": "All prices are illustrative and hypothetical, not real quotes, forecasts, or results.", "hypothetical": true}]$q$::jsonb,
  interactive_config = $q${"scenarios": [{"options": ["Buy stop", "Buy limit", "Sell limit", "Market sell"], "question": "You want to buy only if gold pulls back below the current price. Which order?", "explanation": "A buy limit is placed below the current price to buy a pullback.", "correctIndex": 1}, {"options": ["$5", "$10", "$100", "$1,000"], "question": "Hypothetical: entry 2,345.00, SL 2,340.00, 0.02 lot (2 oz). What is the planned loss if stopped?", "explanation": "$5.00 stop distance × 2 oz = $10, which is 1% of a $1,000 account.", "correctIndex": 1}, {"options": ["Only on big trades", "Add it later if price goes against you", "Every trade, attached when placed", "Not needed on a small account"], "question": "What is the GFX rule for stop losses?", "explanation": "Every trade gets a stop loss when it is placed, even on a small cents account, to build the habit.", "correctIndex": 2}]}$q$::jsonb,
  updated_at = now()
where id = 'c7eaf0f2-c415-4b9a-97c9-84f0095a721a'
  and md5(coalesce(content,'')) = '9a3cae6cd46e246b5a03a3fade8b2a1e'
  and md5(coalesce(key_takeaways::text,'')) = 'acffc9b5e88a58eb85ccd988bc5a5a07'
  and md5(coalesce(examples::text,'')) = '6ff08a5d3903fff4daa9f2db444b7308'
  and md5(coalesce(interactive_config::text,'')) = 'ff01cd027553b98905cea61826928b77';

-- candlestick-patterns
update public.lessons set
  content = $q$Why patterns
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$q$,
  updated_at = now()
where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0'
  and md5(coalesce(content,'')) = 'b9da5bbe2d08e7af5018d878290bceae';

-- diagnostic platform_demo_purpose (correct_index 0 unchanged)
update public.diagnostic_questions set
  question = $q$You've never used MT5 and want to learn where the Buy, Sell and SL/TP buttons are before your first real trade. What's a no-risk way to do that?$q$,
  options = $q$["Explore the free MT5 demo (optional practice tool)", "Maximum leverage", "Place a big real trade to learn fast", "Skip learning the buttons and guess"]$q$::jsonb,
  explanation = $q$The MT5 demo uses virtual money, so it's a no-risk way to learn the app's buttons. It won't train your emotions; for that, GFX suggests a small cents account with max 1% risk and a stop loss on every trade.$q$
where id = '3a89b300-bdbb-445e-9a4b-4420ea579057'
  and md5(question) = '68890c4260d9b1c0319547593d3b62e4'
  and md5(options::text) = 'a0082288d1581e4de08dedab8aafcb49'
  and md5(coalesce(explanation,'')) = '89e6eeb77b77f532e6c0903ec2d73831';

-- diagnostic setups_trading_plan_purpose (correct_index 2 unchanged)
update public.diagnostic_questions set
  options = $q$["A cents account", "The spread", "A trading plan", "A broker account"]$q$::jsonb
where id = '9de5a6fa-a5bb-457d-b8c1-1a330f7dfdcb'
  and md5(options::text) = 'b6313aad377f4d418fc96256869dbbf6';

-- diagnostic risk_management_stop_loss (correct_index 1 unchanged)
update public.diagnostic_questions set
  options = $q$["Only on small cents accounts", "No — never trade without a stop loss, no exceptions", "Yes, if experienced", "Yes, always skip it on Gold"]$q$::jsonb
where id = 'a2e0f08f-7098-49a6-9ea2-3d0b5dae0688'
  and md5(options::text) = '22c72841c6cd0e8589894c2573812855';

-- diagnostic gold_news_release (correct_index 2 unchanged)
update public.diagnostic_questions set
  question = $q$A major US economic report is due in 5 minutes and Gold is already moving fast. As a beginner trading a small cents account, what is the most sensible approach?$q$
where id = 'ebdfe0f7-704f-4997-86f2-7de6a461e2f9'
  and md5(question) = '7d2baf39b41ff929c79d3dc5f6865e9f';

-- diagnostic journaling_weekly_review (correct_index 0 unchanged)
update public.diagnostic_questions set
  question = $q$At the end of the week you review your trading journal. Which measure best shows whether you are improving as a beginner?$q$,
  options = $q$["How many trades followed every rule in your plan", "Your account balance compared with last week", "How many trades you opened", "Your single biggest winning trade"]$q$::jsonb
where id = '04d9eaf5-ca4c-42cf-bbdd-9e10560dd28a'
  and md5(question) = '33c79200452e5aac995d98dd8d97ae3f'
  and md5(options::text) = '569e5308a99250b3c0e4e4c467720d51';

-- diagnostic setups_lot_size_from_stop (correct_index 1 unchanged)
update public.diagnostic_questions set
  question = $q$Hypothetically, your account is $1,000 and you risk max 1% per trade. Your planned Gold stop distance is $2.50. With 0.01 lot = 1 oz (a $0.01 move = $1 per standard lot), what lot size fits the rule?$q$
where id = '8c7292b0-f870-49b3-8d21-84bf04d75812'
  and md5(question) = '639f13e2ef802b7ae0b25b2436db8650';

-- diagnostic psychology_moving_stop (correct_index 2 unchanged)
update public.diagnostic_questions set
  question = $q$Your trade is moving toward your stop loss, so you move the stop further away to 'give it more room'. What is the main problem?$q$
where id = '8b7fc3b0-032f-4495-a7b8-2650a448a946'
  and md5(question) = 'a277961e77460a966e999da3a240e1be';

-- diagnostic platform_attach_stop_loss (correct_index 0 unchanged)
update public.diagnostic_questions set
  options = $q$["When you place the order, as part of the order", "Only after the trade starts losing", "At the end of the day", "Only on big accounts, not on a small cents account"]$q$::jsonb,
  explanation = $q$Attach the stop loss when you place the order so the trade is protected from the first second, and do it on every trade, even on a small cents account, to build the habit.$q$
where id = 'd5e7864f-7214-4b98-823d-202e9192ca7c'
  and md5(options::text) = 'd75c376d2c26d4512a9e58eaafab1520'
  and md5(coalesce(explanation,'')) = 'b248e6b91ccef053a7252c93bd424d86';

-- level college
update public.levels set
  description = $q$Strategy, backtesting, real-money prep.$q$,
  updated_at = now()
where id = 'fbb55f0c-cb4c-4f43-9e2f-70aeff160ab2'
  and description = $q$Strategy, backtesting, live prep.$q$;

-- level graduation
update public.levels set
  title = $q$Level 6: Real-Money Discipline: Ready Ka Na Ba?$q$,
  description = $q$Checklist para sa real money: start small, sundin ang plan, max 1% risk, laging may stop loss.$q$,
  updated_at = now()
where id = 'e42c66c8-abee-47ec-9fa6-d5e67ee7cf34'
  and title = $q$Level 6: Demo to Live — Are You Ready?$q$
  and description = $q$A readiness checklist: demo first, plan-following, 1% risk.$q$;

commit;
