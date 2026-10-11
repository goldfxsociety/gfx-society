-- Verify 20261011190000_stocks_vs_forex_vs_gold_headings_taglish.sql (read-only). Expect one row, all true.
select
  md5(content) = 'e6128ae9f482de66481ad6ea5ea3e6c1'                                 as content_exact,
  content like '## TL;DR sa Taglish%'                   as tldr_first,
  (select count(*) from regexp_matches(content, '(^|\n)## ', 'g')) = 8 as headings,
  (select count(*) from regexp_matches(content, 'Sa Taglish: ', 'g')) = 7 as taglish_lines,
  content like '%Start on demo, then optionally a cents account with small money you can afford to lose; max 1\% risk per trade, stop-loss on every trade.%' as standard_line,
  content like '%Demo muna. Pagkatapos, optional ang cents account na maliit na pera lang na kaya mong mawala. Max 1\% risk bawat trade, laging may stop loss.%' as taglish_risk_line,
  content not like '%Taglish summary%'                  as old_summary_removed,
  (select count(*) from regexp_matches(content, 'All prices are illustrative', 'g')) = 1 as one_hypothetical_note
from lessons where slug = 'stocks-vs-forex-vs-gold';
