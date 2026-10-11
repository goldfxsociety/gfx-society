-- Founder policy: beginners may use a cents account (small real money they can
-- afford to lose) after demo. Standard line:
--   'Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.'
-- Broker-neutral; all risk warnings kept; no outcome guarantees.
-- Lessons: demo-account-your-practice-ground, demo-vs-live-account,
-- opening-your-accm-account (Level 6). No quiz item becomes wrong: the
-- options/correctIndex are unchanged (checked against live text read-only 2026-10-11).
-- Idempotent: each UPDATE runs only while the old text is present / the new text absent.
-- Sorts after the latest recorded version (20261011043946). NOT APPLIED.

-- 1) Demo Account lesson: 'When to consider live' paragraph + Taglish summary.
update lessons
set content = replace(replace(content, 'Going live is optional. If you do, start with a small amount you can afford to lose, keep the same 1% rule, and seek your own independent advice.', 'Going live is optional. Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade. A cents account is a real-money account whose balance is shown in cents (for example, a $10 deposit shows as 1,000) and that allows very small lot sizes, so you can feel real-money emotions with tiny amounts. Not every broker offers one. Losses are still real, and results are not guaranteed. Seek your own independent advice.'), 'Hindi required mag-live; kung gagawin mo, maliit lang muna at pareho pa rin ang rules.', 'Hindi required mag-live. Demo muna, tapos optional ang cents account: totoong pera pero maliit lang, nakikita ang balance in cents at napakaliit ng lot size. Pera lang na kaya mong mawala, 1% max risk, at laging may stop loss.'),
    updated_at = now()
where slug = 'demo-account-your-practice-ground'
  and (content like '%Going live is optional. If you do, start with a small amount you can afford to lose, keep the same 1% rule, and seek your own independent advice.%' or content like '%Hindi required mag-live; kung gagawin mo, maliit lang muna at pareho pa rin ang rules.%');

-- 1b) Demo Account lesson: add the standard line as a takeaway (once).
update lessons
set key_takeaways = key_takeaways || jsonb_build_array('Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.'::text),
    updated_at = now()
where slug = 'demo-account-your-practice-ground'
  and jsonb_typeof(key_takeaways) = 'array'
  and key_takeaways::text not like '%cents account%';

-- 2) Demo vs Live lesson: short cents-account section + takeaway (once each).
update lessons
set content = content || '

A smaller step: the cents account
Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade. A cents account is a real-money account whose balance is shown in cents (for example, a $10 deposit shows as 1,000) and that allows very small lot sizes, so you can feel real-money emotions with tiny amounts. Not every broker offers one. Losses are still real, and results are not guaranteed.',
    updated_at = now()
where slug = 'demo-vs-live-account'
  and content like '%Real money triggers fear and greed at a level demo never can.%'
  and content not like '%cents account%';

update lessons
set key_takeaways = key_takeaways || jsonb_build_array('Start on demo, then optionally a cents account with small money you can afford to lose; max 1% risk per trade, stop-loss on every trade.'::text),
    updated_at = now()
where slug = 'demo-vs-live-account'
  and jsonb_typeof(key_takeaways) = 'array'
  and key_takeaways::text not like '%cents account%';

-- 3) Opening Your ACCM Account (Level 6): step 5 + takeaway.
update lessons
set content = replace(content, '5. Only consider live trading after several weeks of following your trading plan consistently on demo (1% max risk, stop-loss on every trade), and only with money you can afford to lose', '5. Only consider real-money trading after several weeks of following your trading plan consistently on demo (1% max risk, stop-loss on every trade), and only with money you can afford to lose. A cents account (balance shown in cents, very small lot sizes), if your broker offers one, is an optional first step with small money'),
    key_takeaways = replace(key_takeaways::text, 'Move to live only after weeks of following your plan consistently on demo (1% risk, stop-loss every trade), never because of a profit target.', 'Move to real money only after weeks of following your plan consistently on demo (1% risk, stop-loss every trade), optionally starting with a cents account, never because of a profit target.')::jsonb,
    updated_at = now()
where slug = 'opening-your-accm-account'
  and (content like '%5. Only consider live trading after several weeks of following your trading plan consistently on demo (1% max risk, stop-loss on every trade), and only with money you can afford to lose%' or key_takeaways::text like '%Move to live only after weeks of following your plan consistently on demo (1% risk, stop-loss every trade), never because of a profit target.%')
  and content not like '%cents account%';
