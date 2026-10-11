-- Lesson 3 (how-do-traders-make-money): PR-spec-lessons-2-5-copy.md, same pattern as #25 (Lesson 1).
-- "## " section headings, "TL;DR sa Taglish" at the top (replacing the bottom
-- "Taglish summary") with the standard Taglish risk line, one "Sa Taglish:" line
-- per section, and the closing disclaimer aligned with the cents standard line.
-- English section bodies, examples, convention notes, takeaways and quiz unchanged.
-- Guarded on today's exact live text (md5 a8ef48d9345aeaa44a1e58f7872b1fcd): idempotent, and a no-op if the
-- lesson changed in the meantime. Sorts after the latest recorded version
-- (20261011120129). NOT APPLIED.
update lessons
set content = $gfx$## TL;DR sa Taglish
Pwede kang mag-buy (go long) kung expect mong tataas ang price, o mag-sell (go short) kung bababa, and either way pwede kang matalo. Walang trader na laging panalo; normal ang losing streaks. Ang mahalaga ay controlled ang talo: max 1% ng account per trade, laging may stop loss. May costs din ang bawat trade, like the spread. GFX does not promise profits; ang goal ay matuto at protektahan ang capital mo, starting sa demo.
Demo muna. Pagkatapos, optional ang cents account na maliit na pera lang na kaya mong mawala. Max 1% risk bawat trade, laging may stop loss.

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
Many retail traders lose money, especially when using leverage. GFX does not promise profits. The goal of this Academy is to help you understand the market, build a plan, and protect your capital while you learn, starting on a demo account.
Sa Taglish: Maraming retail traders ang nalulugi, lalo na with leverage. Walang profit promise ang GFX; ang focus ay understanding, plan at protecting your capital, demo muna.

## Why risk per trade matters more than wins
Imagine two hypothetical traders. One risks 1% of their account per trade; after five losses in a row they are down about 5% and can keep learning. The other risks 20% per trade; after the same five losses they have lost most of their account. Same market, same bad luck, very different outcome. Small, consistent risk keeps you in the game long enough to improve.
Sa Taglish: After 5 losses in a row: sa 1% risk, down lang ng about 5%; sa 20% risk, halos ubos na ang account. Small, consistent risk keeps you in the game.

## Process over profit
As a beginner, judge yourself by whether you followed your plan: did every trade have a stop loss, was the size within 1%, did you journal it? These are things you control. Outcomes of single trades are partly luck and are not a good measure of skill.
Sa Taglish: I-judge ang sarili mo kung nasunod mo ang plan: may stop loss, within 1%, naka-journal. Partly luck ang result ng isang trade.

## Quick recap
Trades can gain or lose in either direction, costs apply to every trade, and losing streaks happen to everyone. Keep risk small and consistent, at max 1% per trade, and practice on demo first.
Sa Taglish: Pwedeng manalo o matalo sa long o short, may costs lagi, at normal ang losing streaks. Max 1% per trade, demo muna.

## Gold example (hypothetical): Long vs short on gold
• Hypothetical long: buy 0.01 lot (1 oz) XAUUSD at 2,350.00, stop loss at 2,345.00.
• If price rises to 2,355.00, the position is up $5.00 per oz = $5 (before costs).
• If price falls to the stop loss at 2,345.00, the position closes at a loss of $5.00 per oz = $5 (plus costs).
• Hypothetical short: sell 0.01 lot at 2,350.00; if price falls to 2,345.00 the position is up $5, if it rises to 2,355.00 it is down $5.
These are illustrative numbers before costs, not results. Convention note: GFX lessons treat a $0.01 move in XAUUSD as 1 pip, and 1 standard lot as 100 oz, so a $0.01 move = $1 per standard lot. Many brokers define a gold pip differently (often $0.10) and contract sizes can vary. Always check your own broker's contract specifications.
All prices are illustrative and hypothetical, not real quotes, forecasts, or results.
Sa Taglish: Sa 0.01 lot, ang $5 na galaw ay $5 na gain o $5 na loss (before costs), depende kung long o short ka at saan pumunta ang price.

Trading involves real risk of loss. GFX provides education only, not financial advice. Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.$gfx$,
    updated_at = now()
where slug = 'how-do-traders-make-money'
  and md5(content) = 'a8ef48d9345aeaa44a1e58f7872b1fcd';
