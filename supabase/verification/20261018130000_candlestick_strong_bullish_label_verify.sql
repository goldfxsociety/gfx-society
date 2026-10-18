-- Verify 20261018130000_candlestick_strong_bullish_label.sql (read-only).

-- 1) Label renamed. Expect 1 row, ok = true.
select slug, (interactive_config #>> '{patterns,0,id}' = 'bullish-engulfing'
   and interactive_config #>> '{patterns,0,signal}' = 'Strong bullish sign') as ok
from public.lessons where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0';

-- 2) No "Strong Buy" left in any lesson or diagnostic. Expect 0.
select (select count(*) from public.lessons where coalesce(interactive_config::text,'') ilike '%strong buy%' or content ilike '%strong buy%')
     + (select count(*) from public.diagnostic_questions where (question||options::text||coalesce(explanation,'')) ilike '%strong buy%') as remaining;

-- 3) Nothing else in interactive_config changed: everything except patterns[0].signal equals the pre-migration value. Expect ok = true.
select (jsonb_set(interactive_config, '{patterns,0,signal}', '"Strong Buy"'::jsonb, false)::text) is not null
   and md5(jsonb_set(interactive_config, '{patterns,0,signal}', '"Strong Buy"'::jsonb, false)::text) = 'cbd3a72855455ccd2bba1b2ca4688444' as ok
from public.lessons where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0';
