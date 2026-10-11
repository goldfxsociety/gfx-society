-- Lesson 2 (stocks-vs-forex-vs-gold): PR-spec-lessons-2-5-copy.md, same pattern as #25 (Lesson 1).
-- "## " section headings, "TL;DR sa Taglish" at the top (replacing the bottom
-- "Taglish summary") with the standard Taglish risk line, one "Sa Taglish:" line
-- per section, and the closing disclaimer aligned with the cents standard line.
-- English section bodies, examples, convention notes, takeaways and quiz unchanged.
-- Guarded on today's exact live text (md5 273985bd1d8e827ba000aa7ac540a2a9): idempotent, and a no-op if the
-- lesson changed in the meantime. Sorts after the latest recorded version
-- (20261011120129). NOT APPLIED.
update lessons
set content = $gfx$## TL;DR sa Taglish
Stocks = share sa isang company. Forex = trading ng isang currency against another, like USD vs PHP. Gold (XAUUSD) = price ng gold in US dollars. Gumagalaw ang gold dahil sa fear, inflation, interest rates at lakas ng US dollar, at minsan sobrang bilis, lalo na sa big US news. Kaya smaller lot muna, laging may stop loss, at iwas muna sa big news habang nagpa-practice sa demo.
Demo muna. Pagkatapos, optional ang cents account na maliit na pera lang na kaya mong mawala. Max 1% risk bawat trade, laging may stop loss.

## Three common markets
Stocks are shares of ownership in a company; their prices react to company results and the wider economy. Forex (foreign exchange) is the trading of one currency against another, for example USD against PHP. Gold is a commodity; XAUUSD is gold priced in US dollars and is usually traded on forex-style platforms.
Sa Taglish: Stocks follow ang company results, forex ay currency vs currency, at ang gold ay commodity na usually tine-trade sa forex-style platforms.

## What moves gold
Gold often reacts to: fear and uncertainty (some investors buy gold as a perceived safe haven), inflation expectations, interest-rate expectations, and the strength of the US dollar. Major US economic releases (like inflation or jobs data) can cause sharp, fast moves within minutes.
Sa Taglish: Fear, inflation, interest rates at ang US dollar ang madalas nagpapagalaw sa gold, at ang big US news pwedeng magpa-spike ng price within minutes.

## Why gold is popular, and why it needs care
Gold is very liquid and trades nearly around the clock on weekdays, which makes it accessible. But it can also move quickly and widely. That speed cuts both ways: losses can grow as fast as gains. For beginners that means smaller position sizes, a stop loss on every trade, and avoiding trading right at big news releases until you have practiced on demo.
Sa Taglish: Liquid ang gold at open halos buong weekdays, pero mabilis gumalaw: kasing-bilis ng gains ang losses. Kaya small size, stop loss, at demo muna.

## Comparing them simply
Stocks: tied to company performance, trade during exchange hours. Forex: tied to economies and interest rates, trades 24/5. Gold: tied to fear, inflation, rates and the dollar, trades nearly 24/5 and is often more volatile than major currency pairs.
Sa Taglish: Stocks = company at exchange hours; forex = economies at 24/5; gold = fear, inflation, rates at dollar, halos 24/5 at madalas mas volatile.

## What you actually trade on a platform
Most retail gold trading happens through contracts (often CFDs) that follow the gold price. You don't receive physical gold; you gain or lose based on how the price moves while your position is open. This makes it easy to go long or short, but it also means leverage and costs apply, so the same risk rules matter here as in any market.
Sa Taglish: Usually CFD ang tine-trade mo, hindi physical gold. Pwede kang long o short, pero may leverage at costs, kaya same risk rules pa rin.

## Before you trade any market
Whichever market you choose, the basics don't change: understand what moves it, know its trading hours and typical volatility, check all costs, and size every position so that a loss stays within 1% of your account. For now, focus on one market, gold, and learn it well on a demo account before adding anything else.
Sa Taglish: Alamin kung ano ang nagpapagalaw, ang trading hours at costs, at i-size ang bawat trade para max 1% lang ang talo. Focus muna sa gold, sa demo.

## Gold example (hypothetical): How a news spike can look
• Hypothetical: XAUUSD is at 2,340.00 a few minutes before a US inflation report.
• The report surprises the market and gold jumps to 2,352.00 within minutes, a $12.00 move.
• On 1 standard lot (100 oz), a $12.00 move equals $1,200; on 0.01 lot (1 oz), it equals $12.
• The same move in the opposite direction would be a loss of the same size, which is why position size and a stop loss matter.
Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.
Sa Taglish: Ang $12 na galaw ay $1,200 sa 1 standard lot pero $12 lang sa 0.01 lot, at ganoon din kalaki ang talo kung pabaliktad. Kaya mahalaga ang size at stop loss.

Trading involves real risk of loss. GFX provides education only, not financial advice. Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.$gfx$,
    updated_at = now()
where slug = 'stocks-vs-forex-vs-gold'
  and md5(content) = '273985bd1d8e827ba000aa7ac540a2a9';
