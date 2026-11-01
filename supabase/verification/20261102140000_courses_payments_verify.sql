-- Verification (read-only). Run after 20261102140000 + 20261102140100; every column must be true.
select
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('admins','training_courses','training_modules','training_lessons',
                                                  'course_purchases','training_progress')) as rls_on,
  (select count(*) = 0 from information_schema.role_table_grants
     where table_schema = 'public' and table_name in ('admins','training_courses','training_modules','training_lessons','course_purchases','training_progress')
       and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')) as no_client_writes,
  (select count(*) = 0 from information_schema.role_table_grants
     where table_schema = 'private' and grantee in ('anon','authenticated')) as private_closed,
  (select count(*) = 2 from storage.buckets where id in ('receipts','payment-assets') and public = false) as buckets_private,
  (select bool_and(p.prosecdef and array_to_string(p.proconfig, ',') like 'search_path=%')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('is_admin','is_member','has_course_access','has_paid_access','get_lesson_quiz',
       'submit_lesson_quiz','set_practice_done','my_payment_info','submit_course_purchase','decide_course_purchase',
       'mark_receipt_deleted','pending_payments_summary')) as secdef_pinned,
  (select count(*) = 1 from public.training_courses where slug = 'gold-reset' and price_php = 0 and status = 'open') as gold_reset_seeded,
  (select count(*) = 0 from public.training_courses where price_php > 0 and sales_open) as no_paid_sales_open,
  (select count(*) = 0 from pg_indexes where schemaname = 'public' and tablename = 'course_purchases'
     and indexname = 'course_purchases_one_per_course') = false as one_per_course_index;
