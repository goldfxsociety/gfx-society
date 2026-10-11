-- Verify 20261011180000_lesson1_tldr_balanced_taglish.sql (read-only). Expect one row, all true.
select
  md5(content) = '27ae186c2651ae4f088817e89a3c4360'                                   as content_exact,
  content like '%XAUUSD = price ng 1 troy ounce ng Gold in US dollars.%' as troy_ounce_fixed,
  content not like '%presyo ng 1 ounce%'                  as old_tldr_gone,
  content like '%Start on demo, then optionally a cents account with small money you can afford to lose; max 1\% risk per trade, stop-loss on every trade.%' as risk_line_kept,
  (select count(*) from regexp_matches(content, '(^|\n)## ', 'g')) = 8 as headings_kept
from lessons where slug = 'what-is-the-financial-market';
