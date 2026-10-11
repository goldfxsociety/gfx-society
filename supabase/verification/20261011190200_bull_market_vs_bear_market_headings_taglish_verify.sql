-- Verify 20261011190200_bull_market_vs_bear_market_headings_taglish.sql (read-only). Expect one row, all true.
select
  md5(content) = '915b0e612df339e928739045813d0f8c'                                 as content_exact,
  content like '## TL;DR sa Taglish%'                   as tldr_first,
  (select count(*) from regexp_matches(content, '(^|\n)## ', 'g')) = 10 as headings,
  (select count(*) from regexp_matches(content, 'Sa Taglish: ', 'g')) = 9 as taglish_lines,
  content like '%Start on demo, then optionally a cents account with small money you can afford to lose; max 1\% risk per trade, stop-loss on every trade.%' as standard_line,
  content like '%Demo muna. Pagkatapos, optional ang cents account na maliit na pera lang na kaya mong mawala. Max 1\% risk bawat trade, laging may stop loss.%' as taglish_risk_line,
  content not like '%Taglish summary%'                  as old_summary_removed,
  (select count(*) from regexp_matches(content, 'All prices are illustrative', 'g')) = 1 as one_hypothetical_note
from lessons where slug = 'bull-market-vs-bear-market';
