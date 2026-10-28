-- Verify 20261019014000_candlestick_tips_confirmation.sql (read-only).
-- Every check row should return ok = true.
with l as (
  select interactive_config c from public.lessons
  where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0'
)
select '1 bullish-engulfing tip' as check, (c #>> '{patterns,0,id}') = 'bullish-engulfing'
   and (c #>> '{patterns,0,tip}') = $q$Most powerful at support zones or after a downtrend. Wait for confirmation bago mag-decide ng kahit anong trade.$q$ as ok from l
union all
select '2 hammer tip', (c #>> '{patterns,2,id}') = 'hammer'
   and (c #>> '{patterns,2,tip}') = $q$Only valid at support or after a downtrend. The longer the lower wick, the stronger the sign.$q$ from l
union all
select '3 shooting-star tip', (c #>> '{patterns,3,id}') = 'shooting-star'
   and (c #>> '{patterns,3,tip}') = $q$Only valid at resistance or after an uptrend. The longer the upper wick, the stronger the sign.$q$ from l
union all
select '4 doji tip', (c #>> '{patterns,4,id}') = 'doji'
   and (c #>> '{patterns,4,tip}') = $q$By itself, a doji just means indecision. Watch the next candle — kung mag-break ito sa isang direction, hintayin ang confirmation bago mag-decide.$q$ from l
union all
select '5 bearish-engulfing tip unchanged (#41)',
   (c #>> '{patterns,1,tip}') = $q$Most powerful at resistance zones or after an uptrend. Wait for confirmation bago mag-decide ng kahit anong trade.$q$ from l
union all
select '6 pin-bar tip unchanged (#41)',
   (c #>> '{patterns,5,tip}') = $q$One of the most traded patterns in price action. Ang rejection wick ay nagpapakita kung saan tinanggihan ang price. Hintayin ang confirmation bago mag-decide.$q$ from l
union all
select '7 no old phrasing left', c::text not like '%follow it%'
   and c::text not like '%Confirm with the next candle%'
   and c::text not like '%stronger the signal%' from l
union all
-- md5 of the full expected post-migration row (computed on a local copy of the live row)
select '8 full config md5', md5(c::text) = '8063d2f300eaeb44d0e6cbef39c51e23' from l;
