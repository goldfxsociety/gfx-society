-- 02_apply.sql
-- lesson-risk-dedupe spec (/workspace/gfx/design/trading-system/lesson-risk-dedupe-spec.md), 13 lessons.
-- Applies the 14 edits on 13 rows (cents-account has a content edit and a takeaway edit). Matches on slug; each step only
-- changes text that is still the old string; rows without a backup are never touched. Safe to rerun (0 rows the second time).

begin;

with k as (
  select
    $s$Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$s$::text as closing,
    $s$Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$s$::text as short,
    $s$Disclosure: ACCM is GFX's partner broker. Education only, not financial advice.$s$::text as disc_old,
    $s$Disclosure: ACCM is GFX's partner broker.$s$::text as disc_new,
    $s$Max 1% risk per trade, stop-loss on every trade.$s$::text as max_old,
    $s$Use no more than 1% of the account on each trade, with a stop-loss on every trade.$s$::text as max_new
),
t as (
  -- The whole edit as one pure expression per row. Every step is a no-op once its old text is gone (safe to rerun).
  select l.id, l.slug, l.content as old_content, l.key_takeaways as old_tk,
    case
      -- A: mid-body SHORT line (directly before a "## " heading) + trailing CLOSING paragraph
      when l.slug in ('what-is-the-financial-market', 'stocks-vs-forex-vs-gold', 'how-do-traders-make-money', 'bull-market-vs-bear-market', 'what-is-a-spread') then
        (select case when right(x, length(E'\n\n' || k.closing)) = E'\n\n' || k.closing
                     then left(x, length(x) - length(E'\n\n' || k.closing)) else x end
           from (select replace(l.content, E'\n' || k.short || E'\n\n## ', E'\n\n## ') as x) s)
      -- B: trailing CLOSING paragraph only
      when l.slug in ('what-is-a-broker', 'candlestick-anatomy', 'candlestick-patterns', 'pips-lots-and-leverage', 'types-of-orders', 'cents-account-your-first-real-money-practice') then
        case when right(l.content, length(E'\n\n' || k.closing)) = E'\n\n' || k.closing
             then left(l.content, length(l.content) - length(E'\n\n' || k.closing)) else l.content end
      -- D: drop the extra NFA after the IB disclosure; rephrase the exact "Max 1% risk per trade" step
      when l.slug in ('opening-your-accm-account') then replace(replace(l.content, k.disc_old, k.disc_new), k.max_old, k.max_new)
      else l.content
    end as new_content,
    -- C: remove the last takeaway only when it is exactly SHORT
    case when l.slug in ('cents-account-your-first-real-money-practice', 'real-money-and-your-emotions') and l.key_takeaways ->> -1 = k.short then l.key_takeaways - (-1) else l.key_takeaways end as new_tk
  from public.lessons l, k
  where l.slug in ('bull-market-vs-bear-market', 'candlestick-anatomy', 'candlestick-patterns', 'cents-account-your-first-real-money-practice', 'how-do-traders-make-money', 'opening-your-accm-account', 'pips-lots-and-leverage', 'real-money-and-your-emotions', 'stocks-vs-forex-vs-gold', 'types-of-orders', 'what-is-a-broker', 'what-is-a-spread', 'what-is-the-financial-market')
)
update public.lessons l
set content = t.new_content, key_takeaways = t.new_tk, updated_at = now()
from t
where l.id = t.id
  and (l.content is distinct from t.new_content or l.key_takeaways is distinct from t.new_tk)
  and exists (select 1 from public.lessons_backup_20261115_risk_dedupe b where b.id = l.id)
returning l.slug;

commit;
