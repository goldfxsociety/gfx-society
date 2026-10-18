-- Verify 20261018140000_candlestick_pinbar_tips.sql (read-only).

-- 1) Three fields updated. Expect 1 row, ok = true.
select slug, (interactive_config #>> '{patterns,5,id}' = 'pin-bar'
   and interactive_config #>> '{patterns,5,signal}' = 'Possible reversal sign'
   and interactive_config #>> '{patterns,5,tip}' = 'One of the most traded patterns in price action. Ang rejection wick ay nagpapakita kung saan tinanggihan ang price. Hintayin ang confirmation bago mag-decide.'
   and interactive_config #>> '{patterns,1,id}' = 'bearish-engulfing'
   and interactive_config #>> '{patterns,1,tip}' = 'Most powerful at resistance zones or after an uptrend. Wait for confirmation bago mag-decide ng kahit anong trade.') as ok
from public.lessons where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0';

-- 2) Old strings gone from this lesson's interactive_config. Expect 0.
select (
  (interactive_config::text like '%Reversal Signal%')::int
  + (interactive_config::text like '%Always trade in the direction of the rejection wick.%')::int
  + (interactive_config::text like '%Wait for confirmation before shorting.%')::int
) as remaining_old
from public.lessons where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0';

-- 3) Quiz correct answers unchanged. Expect 1 row, ok = true.
select (interactive_config #>> '{scenarios,0,correctIndex}' = '1'
   and interactive_config #>> '{scenarios,1,correctIndex}' = '1'
   and interactive_config #>> '{scenarios,2,correctIndex}' = '1') as ok
from public.lessons where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0';

-- 4) Nothing else in interactive_config changed (restoring the three old values gives the pre-migration md5). Expect ok = true.
select md5(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        interactive_config,
        '{patterns,5,signal}', '"Reversal Signal"'::jsonb, false),
      '{patterns,5,tip}',
      '"One of the most traded patterns in price action. Always trade in the direction of the rejection wick."'::jsonb,
      false),
    '{patterns,1,tip}',
    '"Most powerful at resistance zones or after an uptrend. Wait for confirmation before shorting."'::jsonb,
    false)::text
) = '9f580546535d9e1059cf0c431cd778f1' as ok
from public.lessons where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0';
