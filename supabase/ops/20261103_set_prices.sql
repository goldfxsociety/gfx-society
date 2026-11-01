-- OPS script (not a migration; run by hand on Jarvis's go). Jarvis, 2 Nov, under Ben's delegated go:
-- Basics PHP 2,000, Advanced PHP 2,000, Gold Reset free. price_php is whole PESOS (integer), not centavos.
-- Free path: price_php = 0 -> has_course_access() grants any member, no Buy/pay step. sales_open stays false here.
-- Idempotent: rows already at the target are skipped, so a re-run updates 0 rows and leaves updated_at alone.
begin;
update public.training_courses c
   set price_php = v.price, sales_open = false, updated_at = now()
  from (values ('gold-reset', 0), ('gold-strategy-basics', 2000), ('gold-advanced-setups', 2000)) as v(slug, price)
 where c.slug = v.slug
   and (c.price_php, c.sales_open) is distinct from (v.price, false);
commit;

-- Verify (every row ok = true):
-- select slug, price_php, sales_open,
--        (slug = 'gold-reset' and price_php = 0 or slug <> 'gold-reset' and price_php = 2000) and not sales_open as ok
--   from public.training_courses where slug in ('gold-reset','gold-strategy-basics','gold-advanced-setups') order by sort;
