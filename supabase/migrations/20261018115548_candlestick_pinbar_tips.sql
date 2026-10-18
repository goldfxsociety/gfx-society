-- Candlestick-patterns lesson: Design follow-up (relayed by QA after #40).
--   patterns[5] pin-bar signal: "Reversal Signal" -> "Possible reversal sign"
--   patterns[5] pin-bar tip sentence: "Always trade in the direction of the rejection wick."
--     -> "Ang rejection wick ay nagpapakita kung saan tinanggihan ang price. Hintayin ang confirmation bago mag-decide."
--   patterns[1] bearish-engulfing tip sentence: "Wait for confirmation before shorting."
--     -> "Wait for confirmation bago mag-decide ng kahit anong trade."
-- Quiz scenarios, options and correctIndex untouched.
-- Guarded + idempotent: updates only when today's live interactive_config md5 matches
-- and the three fields still carry the old text. Re-running updates 0 rows.
begin;

update public.lessons
set interactive_config = jsonb_set(
      jsonb_set(
        jsonb_set(
          interactive_config,
          '{patterns,5,signal}',
          to_jsonb('Possible reversal sign'::text),
          false),
        '{patterns,5,tip}',
        to_jsonb('One of the most traded patterns in price action. Ang rejection wick ay nagpapakita kung saan tinanggihan ang price. Hintayin ang confirmation bago mag-decide.'::text),
        false),
      '{patterns,1,tip}',
      to_jsonb('Most powerful at resistance zones or after an uptrend. Wait for confirmation bago mag-decide ng kahit anong trade.'::text),
      false),
    updated_at = now()
where id = 'bf0e27f5-ab9b-4e63-8f77-8b0a692476e0'
  and slug = 'candlestick-patterns'
  and md5(interactive_config::text) = '9f580546535d9e1059cf0c431cd778f1'
  and interactive_config #>> '{patterns,5,id}' = 'pin-bar'
  and interactive_config #>> '{patterns,5,signal}' = 'Reversal Signal'
  and interactive_config #>> '{patterns,5,tip}' = 'One of the most traded patterns in price action. Always trade in the direction of the rejection wick.'
  and interactive_config #>> '{patterns,1,id}' = 'bearish-engulfing'
  and interactive_config #>> '{patterns,1,tip}' = 'Most powerful at resistance zones or after an uptrend. Wait for confirmation before shorting.';

commit;
