-- Verification (read-only). Run after the migration; every column must be true.
select
  (select content not ilike '%regulated broker%' and content like '%may earn a commission or rebate%'
          and interactive_config::text not like '%recommend ACCM%'
     from lessons where slug = 'what-is-a-broker') as broker_ok,
  (select content not like '%consistently profitable%' and key_takeaways::text not like '%consistently profitable%'
          and content like '%may earn a commission or rebate%'
     from lessons where slug = 'opening-your-accm-account') as accm_ok,
  (select interactive_config::text not like '%1-2\%%' from lessons where slug = 'pips-lots-and-leverage') as pips_ok,
  (select content not like '%1-2\%%' and interactive_config::text not like '%1-2\%%'
     from lessons where slug = 'drawdown-and-losing-streaks') as drawdown_ok,
  (select (content || key_takeaways::text || interactive_config::text) not like '%20-30 pips%'
          and content not like '%20 to 30 pips%' and content like '%may earn a commission or rebate%'
     from lessons where slug = 'what-is-a-spread') as spread_ok,
  (select count(*) = 0 from levels where title ilike '%ready to trade live%' or description ilike '%winners from losers%') as levels_ok,
  (select count(*) = 0 from lessons where (content || coalesce(key_takeaways::text,'') || coalesce(interactive_config::text,'')) like '%1-2\%%'
                                      or (content || coalesce(key_takeaways::text,'')) like '%1 to 2\%%') as no_1_2pct_anywhere;
