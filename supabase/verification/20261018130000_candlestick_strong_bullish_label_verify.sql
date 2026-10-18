-- Verify 20261018130000_candlestick_strong_bullish_label.sql (read-only).

-- 1) Both labels renamed. Expect 1 row, ok = true.
select slug, (interactive_config #>> '{patterns,0,id}' = 'bullish-engulfing'
   and interactive_config #>> '{patterns,0,signal}' = 'Strong bullish sign'
   and interactive_config #>> '{patterns,1,id}' = 'bearish-engulfing'
   and interactive_config #>> '{patterns,1,signal}' = 'Strong bearish sign') as ok
from public.lessons where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0';

-- 2) No "Strong Buy"/"Strong Sell" left in any lesson or diagnostic. Expect 0.
select (select count(*) from public.lessons
          where (coalesce(interactive_config::text,'')||coalesce(examples::text,'')||coalesce(content,'')) ~* 'strong (buy|sell)')
     + (select count(*) from public.diagnostic_questions
          where (question||options::text||coalesce(explanation,'')) ~* 'strong (buy|sell)') as remaining;

-- 3) No other pattern "signal" value is a bare Buy/Sell verdict. Expect 0 rows.
select l.slug, v #>> '{}' as signal
from public.lessons l, lateral jsonb_path_query(l.interactive_config, 'strict $.**.signal') v
where (v #>> '{}') ~* '\m(buy|sell)\M';

-- 4) Nothing else in interactive_config changed (restoring the two old labels gives the pre-migration md5). Expect ok = true.
select md5(jsonb_set(jsonb_set(interactive_config, '{patterns,0,signal}', '"Strong Buy"'::jsonb, false),
                     '{patterns,1,signal}', '"Strong Sell"'::jsonb, false)::text) = 'cbd3a72855455ccd2bba1b2ca4688444' as ok
from public.lessons where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0';
