-- Read-only. Returns one boolean: true when RLS is on (not forced) with no policies on both tables.
select
  (select bool_and(relrowsecurity and not relforcerowsecurity) from pg_class
    where oid in ('private.member_code_requests'::regclass, 'private.member_code_rejects'::regclass))
  and not exists (select 1 from pg_policies where schemaname = 'private'
                   and tablename in ('member_code_requests', 'member_code_rejects'))
  as member_code_tables_rls_ok;
