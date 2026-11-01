-- OPS rollback for 20261103_open_sales.sql: hides Buy again. Existing purchases/approvals are untouched.
-- Idempotent: a re-run updates 0 rows.
begin;
update public.training_courses
   set sales_open = false, updated_at = now()
 where slug in ('gold-strategy-basics', 'gold-advanced-setups')
   and sales_open is distinct from false;
commit;

-- Verify (every row ok = true):
-- select slug, sales_open, not sales_open as ok
--   from public.training_courses where slug in ('gold-strategy-basics','gold-advanced-setups') order by sort;
