-- Copy spec PR-spec-taglish-copy.md #15: Lesson 1 "TL;DR sa Taglish" paragraph only
-- (balanced Taglish; fixes "1 ounce" -> "1 troy ounce"). The risk line, headings and
-- everything else are untouched.
-- Apply order: AFTER 20261011170000_lesson1_headings_taglish (#25, recorded as
-- 20261011114934). Guarded on the exact post-#25 text (md5 62ec3277b805684f174fcc0803eadd11):
-- a no-op if #25 isn't applied yet, if this already ran, or if the lesson changed.
-- NOT APPLIED.
update lessons
set content = replace(content, $gfx$Ang financial market ay lugar (karamihan online) kung saan nagbibilihan ng shares, currencies, at commodities tulad ng Gold. Gumagalaw ang presyo depende sa dami ng buyers vs sellers. Ang XAUUSD = presyo ng 1 ounce ng Gold sa US Dollar. Bilang beginner, hindi mo trabaho mang-hula, trabaho mong matuto at mag-practice sa demo muna.$gfx$, $gfx$Ang financial market ay kung saan nagba-buy and sell ng shares, currencies at commodities like Gold, mostly online. Gumagalaw ang price depende sa dami ng buyers vs sellers. XAUUSD = price ng 1 troy ounce ng Gold in US dollars. Bilang beginner, hindi mo job ang mag-predict; ang goal mo ay matuto at mag-practice sa demo muna.$gfx$),
    updated_at = now()
where slug = 'what-is-the-financial-market'
  and md5(content) = '62ec3277b805684f174fcc0803eadd11';
