-- Verify 20261011170000_lesson1_headings_taglish.sql (read-only). Expect one row, all true.
select
  md5(content) = '62ec3277b805684f174fcc0803eadd11'                                         as content_exact,
  content like '## TL;DR sa Taglish%'                           as tldr_first,
  (select count(*) from regexp_matches(content, '(^|\n)## ', 'g')) = 8 as eight_headings,
  content like '%Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.%'                                        as standard_risk_line,
  content like '%Trading involves real risk of loss. GFX provides education only, not financial advice.%' as disclaimer_kept,
  content not like '%Taglish summary%'                          as old_summary_moved,
  content !~* 'profit'                                          as no_profit_wording
from lessons where slug = 'what-is-the-financial-market';
