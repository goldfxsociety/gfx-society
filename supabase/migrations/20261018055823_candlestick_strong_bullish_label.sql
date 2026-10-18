-- Candlestick-patterns lesson: rename the two signal-style verdict labels (education wording, not signals; spec §17):
--   patterns[0] Bullish Engulfing: "Strong Buy"  -> "Strong bullish sign"
--   patterns[1] Bearish Engulfing: "Strong Sell" -> "Strong bearish sign"
-- Quiz scenarios, options and correctIndex untouched.
-- Guarded + idempotent: updates only when today's live interactive_config matches exactly
-- and both patterns still carry the old labels. Re-running updates 0 rows.
begin;

update public.lessons
set interactive_config = jsonb_set(
      jsonb_set(interactive_config, '{patterns,0,signal}', to_jsonb('Strong bullish sign'::text), false),
      '{patterns,1,signal}', to_jsonb('Strong bearish sign'::text), false),
    updated_at = now()
where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0'
  and slug = 'candlestick-patterns'
  and md5(interactive_config::text) = 'cbd3a72855455ccd2bba1b2ca4688444'
  and interactive_config #>> '{patterns,0,id}' = 'bullish-engulfing'
  and interactive_config #>> '{patterns,0,signal}' = 'Strong Buy'
  and interactive_config #>> '{patterns,1,id}' = 'bearish-engulfing'
  and interactive_config #>> '{patterns,1,signal}' = 'Strong Sell';

commit;
