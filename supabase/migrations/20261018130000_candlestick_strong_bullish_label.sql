-- Candlestick-patterns lesson: rename the Bullish Engulfing label "Strong Buy" to "Strong bullish sign"
-- (education wording, not a signal; spec §17). Quiz answers and correctIndex untouched.
-- Guarded + idempotent: only updates when today's live interactive_config matches exactly
-- and patterns[0] is still bullish-engulfing / "Strong Buy". Re-running updates 0 rows.
begin;

update public.lessons
set interactive_config = jsonb_set(interactive_config, '{patterns,0,signal}', to_jsonb('Strong bullish sign'::text), false),
    updated_at = now()
where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0'
  and slug = 'candlestick-patterns'
  and md5(interactive_config::text) = 'cbd3a72855455ccd2bba1b2ca4688444'
  and interactive_config #>> '{patterns,0,id}' = 'bullish-engulfing'
  and interactive_config #>> '{patterns,0,signal}' = 'Strong Buy';

commit;
