-- Candlestick patterns lesson: soften remaining "follow it / confirm before entering / signal"
-- tips into confirmation-first, non-directive wording.
-- Guarded + idempotent: only updates when every targeted tip still holds the exact
-- pre-change text, all in one statement (all-or-nothing). Re-runs update 0 rows.
-- Does NOT touch bearish-engulfing / pin-bar tips (changed in #41) or other lessons.
begin;

update public.lessons
set interactive_config =
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(interactive_config,
    '{patterns,0,tip}', to_jsonb($q$Most powerful at support zones or after a downtrend. Wait for confirmation bago mag-decide ng kahit anong trade.$q$::text)),
    '{patterns,2,tip}', to_jsonb($q$Only valid at support or after a downtrend. The longer the lower wick, the stronger the sign.$q$::text)),
    '{patterns,3,tip}', to_jsonb($q$Only valid at resistance or after an uptrend. The longer the upper wick, the stronger the sign.$q$::text)),
    '{patterns,4,tip}', to_jsonb($q$By itself, a doji just means indecision. Watch the next candle — kung mag-break ito sa isang direction, hintayin ang confirmation bago mag-decide.$q$::text))
where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0'
  and slug = 'candlestick-patterns'
  and interactive_config #>> '{patterns,0,id}' = 'bullish-engulfing'
  and interactive_config #>> '{patterns,2,id}' = 'hammer'
  and interactive_config #>> '{patterns,3,id}' = 'shooting-star'
  and interactive_config #>> '{patterns,4,id}' = 'doji'
  and interactive_config #>> '{patterns,0,tip}' = $q$Most powerful at support zones or after a downtrend. Confirm with the next candle going up before entering.$q$
  and interactive_config #>> '{patterns,2,tip}' = $q$Only valid at support or after a downtrend. The longer the lower wick, the stronger the signal.$q$
  and interactive_config #>> '{patterns,3,tip}' = $q$Only valid at resistance or after an uptrend. The longer the upper wick, the stronger the signal.$q$
  and interactive_config #>> '{patterns,4,tip}' = $q$By itself, a doji just means indecision. Watch the next candle — if it breaks in one direction, follow it.$q$;

commit;
