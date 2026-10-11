-- Lesson 5 (what-is-a-spread): PR-spec-lessons-2-5-copy.md, same pattern as #25 (Lesson 1).
-- "## " section headings, "TL;DR sa Taglish" at the top (replacing the bottom
-- "Taglish summary") with the standard Taglish risk line, one "Sa Taglish:" line
-- per section, and the closing disclaimer aligned with the cents standard line.
-- English section bodies, examples, convention notes, takeaways and quiz unchanged.
-- Guarded on today's exact live text (md5 27a706bcc0265d209caa93ffa6df83f2): idempotent, and a no-op if the
-- lesson changed in the meantime. Sorts after the latest recorded version
-- (20261011120129). NOT APPLIED.
update lessons
set content = $gfx$## TL;DR sa Taglish
Bid = price kung magse-sell ka, ask = price kung magbu-buy ka. Ang difference nila ay ang spread, at cost mo agad iyan pagpasok mo ng trade. Lumalaki ang spread sa big news, sa daily rollover at kapag mababa ang liquidity. Bago pumasok, i-check ang spread at bigyan ng buffer ang stop loss mo. I-practice muna ito sa demo.
Demo muna. Pagkatapos, optional ang cents account na maliit na pera lang na kaya mong mawala. Max 1% risk bawat trade, laging may stop loss.

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
Check the live spread before entering. Avoid trading when spreads are unusually wide. When placing a stop loss, leave room for the spread. Compare conditions on a demo account before going live, and judge any provider on regulation and transparency, not just low spreads.
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

Trading involves real risk of loss. GFX provides education only, not financial advice. Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.$gfx$,
    updated_at = now()
where slug = 'what-is-a-spread'
  and md5(content) = '27a706bcc0265d209caa93ffa6df83f2';
