-- ORDER: run this BEFORE 20261102130000_members_gate_email_otp.sql (it checks claim_membership, which that migration drops). After m2, run 20261102130000_members_gate_email_otp_verify.sql instead.
-- Read-only checks after applying 20261102120000_members_gate_allowlist.sql. Every row should be true.
select 'allowlist has no plaintext/PII columns' as check, (select array_agg(column_name::text order by column_name) from information_schema.columns where table_schema='private' and table_name='member_allowlist') = array['added_at','email_hash','role','seen_at'] as ok
union all select 'anon cannot read member_status', not has_table_privilege('anon','public.member_status','select')
union all select 'authenticated cannot use private schema', not has_schema_privilege('authenticated','private','usage')
union all select 'member_status RLS on', (select relrowsecurity from pg_class where oid='public.member_status'::regclass)
union all select 'anon cannot call claim_membership', not has_function_privilege('anon','public.claim_membership(boolean)','execute')
union all select 'authenticated can call claim_membership', has_function_privilege('authenticated','public.claim_membership(boolean)','execute')
union all select 'authenticated cannot import', not has_function_privilege('authenticated','private.import_allowlist(jsonb)','execute')
union all select 'pepper exists', (select count(*) = 1 from private.app_settings where key='allowlist_pepper');
