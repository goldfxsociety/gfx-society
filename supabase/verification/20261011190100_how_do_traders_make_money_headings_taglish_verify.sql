-- Verify 20261011190100_how_do_traders_make_money_headings_taglish.sql (read-only). Expect one row, all true.
select
  md5(content) = '7a9e6f8d23063f772a3f85434ae91f03'                                 as content_exact,
  content like '## TL;DR sa Taglish%'                   as tldr_first,
  (select count(*) from regexp_matches(content, '(^|\n)## ', 'g')) = 9 as headings,
  (select count(*) from regexp_matches(content, 'Sa Taglish: ', 'g')) = 8 as taglish_lines,
  content like '%Start on demo, then optionally a cents account with small money you can afford to lose; max 1\% risk per trade, stop-loss on every trade.%' as standard_line,
  content like '%Demo muna. Pagkatapos, optional ang cents account na maliit na pera lang na kaya mong mawala. Max 1\% risk bawat trade, laging may stop loss.%' as taglish_risk_line,
  content not like '%Taglish summary%'                  as old_summary_removed,
  (select count(*) from regexp_matches(content, 'All prices are illustrative', 'g')) = 1 as one_hypothetical_note
from lessons where slug = 'how-do-traders-make-money';
