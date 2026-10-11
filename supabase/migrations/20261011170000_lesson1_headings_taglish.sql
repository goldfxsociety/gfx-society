-- Lesson 1 (what-is-the-financial-market): UX audit #4 (GFX-UX-Audit.md).
-- Real "## " section headings (rendered as <h2> by PR UX-B's LessonContent),
-- a "TL;DR sa Taglish" at the top (moved from the bottom "Taglish summary"),
-- one short Taglish line per section, and the closing risk line aligned with the
-- standard line (demo, optional cents account, max 1%, stop-loss). No other text changes.
-- Guarded on the exact current text (md5 2f77292c5d9058c3d9e1ea014cbc4cbd), so it is idempotent and a
-- no-op if the lesson was edited in the meantime. Requires UX-B to render "## "
-- as headings (merge UX-B first). Sorts after 20261011044601. NOT APPLIED.
update lessons
set content = $gfx$## TL;DR sa Taglish
Ang financial market ay lugar (karamihan online) kung saan nagbibilihan ng shares, currencies, at commodities tulad ng Gold. Gumagalaw ang presyo depende sa dami ng buyers vs sellers. Ang XAUUSD = presyo ng 1 ounce ng Gold sa US Dollar. Bilang beginner, hindi mo trabaho mang-hula, trabaho mong matuto at mag-practice sa demo muna.
Demo muna. Pagkatapos, optional ang cents account na maliit na pera lang na kaya mong mawala. Max 1% risk bawat trade, laging may stop loss.

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
Understanding that prices come from millions of decisions helps you stay humble: your job as a beginner is not to predict, but to learn how markets work, manage risk, and practice on a demo account before using real money.
Sa Taglish: Hindi mo trabaho mang-hula. Matuto, mag-manage ng risk, at mag-demo muna.

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

Trading involves real risk of loss. GFX provides education only, not financial advice. Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.$gfx$,
    updated_at = now()
where slug = 'what-is-the-financial-market'
  and md5(content) = '2f77292c5d9058c3d9e1ea014cbc4cbd';
