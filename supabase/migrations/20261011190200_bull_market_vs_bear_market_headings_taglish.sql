-- Lesson 4 (bull-market-vs-bear-market): PR-spec-lessons-2-5-copy.md, same pattern as #25 (Lesson 1).
-- "## " section headings, "TL;DR sa Taglish" at the top (replacing the bottom
-- "Taglish summary") with the standard Taglish risk line, one "Sa Taglish:" line
-- per section, and the closing disclaimer aligned with the cents standard line.
-- English section bodies, examples, convention notes, takeaways and quiz unchanged.  Also removes the duplicated 'All prices are illustrative...' line.
-- Guarded on today's exact live text (md5 227ebf5ea067b729e81ae4f116c50984): idempotent, and a no-op if the
-- lesson changed in the meantime. Sorts after the latest recorded version
-- (20261011120129). NOT APPLIED.
update lessons
set content = $gfx$## TL;DR sa Taglish
Bull market = generally pataas ang price, with higher highs at higher lows. Bear market = pababa, with lower highs at lower lows. Madalas sideways lang ang market, at dito natatalo ang maraming beginners na pinipilit mag-trade. Pwedeng magbago ang trend anytime, kaya kahit sumasabay ka sa trend, laging may stop loss.
Demo muna. Pagkatapos, optional ang cents account na maliit na pera lang na kaya mong mawala. Max 1% risk bawat trade, laging may stop loss.

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
On a demo chart, mark the last three swing highs and lows on two different timeframes and decide: bullish, bearish or sideways? Write your answer, then check how price behaved afterward. You are training your eyes, not trying to predict.
Sa Taglish: Sa demo chart, i-mark ang last 3 swing highs at lows sa dalawang timeframes, isulat kung bullish, bearish o sideways, tapos i-check after. Training ito ng mata, hindi prediction.

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

Trading involves real risk of loss. GFX provides education only, not financial advice. Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.$gfx$,
    updated_at = now()
where slug = 'bull-market-vs-bear-market'
  and md5(content) = '227ebf5ea067b729e81ae4f116c50984';
