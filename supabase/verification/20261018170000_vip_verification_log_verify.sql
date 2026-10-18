-- Verify 20261018170000_vip_verification_log.sql (read-only). Run after applying.

-- 1) Table exists with RLS on. Expect 1 row, ok = true.
select c.relname, (c.relrowsecurity) as ok
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'discord_vip_requests';

-- 2) No RLS policies at all (service role only). Expect policies = 0.
select count(*) as policies from pg_policies where schemaname = 'public' and tablename = 'discord_vip_requests';

-- 3) anon / authenticated / PUBLIC have NO table privileges. Expect 0 rows.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'discord_vip_requests' and grantee in ('anon', 'authenticated', 'PUBLIC');

-- 3b) No ACL entry at all for PUBLIC (grantee 0), anon or authenticated (covers every privilege type). Expect acl_entries = 0.
select count(*) as acl_entries
from pg_class c, lateral aclexplode(c.relacl) a
where c.oid = 'public.discord_vip_requests'::regclass
  and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole));

-- 3c) Effective privileges are all false for anon and authenticated. Expect ok = true.
select bool_and(not has_table_privilege(r, 'public.discord_vip_requests', p)) as ok
from unnest(array['anon', 'authenticated']) r,
     unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p;

-- 3d) No column-level grants to anon / authenticated / PUBLIC. Expect 0 rows.
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'discord_vip_requests' and grantee in ('anon', 'authenticated', 'PUBLIC');

-- 4) service_role can select/insert/update/delete. Expect ok = true.
select (has_table_privilege('service_role', 'public.discord_vip_requests', 'select')
    and has_table_privilege('service_role', 'public.discord_vip_requests', 'insert')
    and has_table_privilege('service_role', 'public.discord_vip_requests', 'update')
    and has_table_privilege('service_role', 'public.discord_vip_requests', 'delete')) as ok;

-- 5) Exactly the expected columns (no image/url/name/amount columns). Expect ok = true.
select (array_agg(column_name::text order by column_name) = array[
  'admin_id', 'approval_message_id', 'card_alert_at', 'created_at', 'decided_at', 'flags', 'guild_id',
  'log_message_id', 'member_id', 'reason_code', 'request_id', 'status']) as ok
from information_schema.columns
where table_schema = 'public' and table_name = 'discord_vip_requests';

-- 6) Snowflakes stored as text; request_id is the primary key. Expect ok = true.
select (bool_and(data_type = 'text') filter (where column_name in ('request_id', 'guild_id', 'member_id', 'admin_id', 'approval_message_id', 'log_message_id'))
    and exists (
      select 1 from information_schema.table_constraints tc
      join information_schema.key_column_usage k using (constraint_schema, constraint_name)
      where tc.table_schema = 'public' and tc.table_name = 'discord_vip_requests'
        and tc.constraint_type = 'PRIMARY KEY' and k.column_name = 'request_id')) as ok
from information_schema.columns
where table_schema = 'public' and table_name = 'discord_vip_requests';

-- 7) One-pending-per-member unique partial index exists. Expect ok = true.
select exists (
  select 1 from pg_indexes
  where schemaname = 'public' and tablename = 'discord_vip_requests'
    and indexname = 'discord_vip_requests_one_pending_per_member'
    and indexdef ilike '%unique%' and indexdef ilike '%where (status = ''pending''::text)%') as ok;

-- 8) Decision/status check constraints present (incl. needs_info and the 6 reason codes). Expect ok = true.
select (count(*) filter (where conname = 'discord_vip_requests_decided_consistency') = 1
    and count(*) filter (where conname = 'discord_vip_requests_reason_only_on_reject') = 1
    and count(*) filter (where pg_get_constraintdef(oid) ilike '%pending%approved%rejected%needs_info%expired%') >= 1
    and count(*) filter (where pg_get_constraintdef(oid) ilike '%not_accm%too_old%') >= 1) as ok
from pg_constraint where conrelid = 'public.discord_vip_requests'::regclass;

-- 9) Table holds only expected values (sanity on live data; 0 rows right after apply). Expect bad = 0.
select count(*) as bad from public.discord_vip_requests
where status not in ('pending', 'approved', 'rejected', 'needs_info', 'expired');

-- 10) Retention index for the 12-month purge exists. Expect ok = true.
select exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'discord_vip_requests_decided_at') as ok;

-- 11) Leftover-card retry: card_alert_at is timestamptz and the partial index exists. Expect ok = true.
select (exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'discord_vip_requests'
                  and column_name = 'card_alert_at' and data_type = 'timestamp with time zone')
    and exists (select 1 from pg_indexes
                where schemaname = 'public' and indexname = 'discord_vip_requests_leftover_cards'
                  and indexdef ilike '%approval_message_id IS NOT NULL%')) as ok;
