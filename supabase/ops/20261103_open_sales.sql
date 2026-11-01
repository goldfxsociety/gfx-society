-- OPS script (not a migration). Run ONLY after prod smoke test D3 (GCash receipt flow) passes, on Jarvis's go.
-- Opens Buy for the paid courses. Gold Reset is free (price 0) and never gets sales_open (the table check forbids it).
-- Table check: sales_open requires price_php > 0 and status = 'open'; the update fails loudly otherwise.
-- Idempotent: a re-run updates 0 rows. Rollback: 20261103_close_sales.sql.
begin;
update public.training_courses
   set sales_open = true, updated_at = now()
 where slug in ('gold-strategy-basics', 'gold-advanced-setups')
   and sales_open is distinct from true;
commit;

-- Verify (every row ok = true):
-- select slug, price_php, status, sales_open, (sales_open and price_php = 2000 and status = 'open') as ok
--   from public.training_courses where slug in ('gold-strategy-basics','gold-advanced-setups') order by sort;
