-- Verify 20261011120000_consent_hardening.sql (read-only).

-- 1) Grants: anon none; authenticated SELECT only.
select grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'consent_records'
group by grantee order by grantee;

-- 2) FK delete rule = SET NULL, user_id nullable, email_hash present, ip_hash gone.
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.consent_records'::regclass and contype = 'f';
select column_name, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'consent_records'
  and column_name in ('user_id', 'email_hash', 'ip_hash') order by 1;   -- expect no ip_hash row

-- 3) Converters: bad input -> false / NULL, never an error. Expect all ok = true.
select v, public.consent_bool(v) as result,
       public.consent_bool(v) = expected as ok
from (values
  ('true'::jsonb, true), ('false'::jsonb, false), ('"true"'::jsonb, true),
  ('"TRUE"'::jsonb, true), ('"yes"'::jsonb, false), ('"bogus"'::jsonb, false),
  ('null'::jsonb, false), ('1'::jsonb, false), ('0'::jsonb, false),
  ('{}'::jsonb, false), ('[true]'::jsonb, false)
) t(v, expected)
union all
select null, public.consent_bool(null), public.consent_bool(null) = false;

select public.consent_ts('bogus') is null as bogus_is_null,
       public.consent_ts('') is null as empty_is_null,
       public.consent_ts('2026-10-10T15:00:00Z') = '2026-10-10T15:00:00Z'::timestamptz as iso_ok;

-- 4) Hook decisions (read-only, pure function). Expect: allow, reject, allow, allow, reject.
select label, public.hook_require_signup_consent(ev) ? 'error' as rejected
from (values
  ('email + consent true',    '{"user":{"app_metadata":{"provider":"email"},"user_metadata":{"consent_required":true}}}'::jsonb),
  ('email + no consent',      '{"user":{"app_metadata":{"provider":"email"},"user_metadata":{}}}'::jsonb),
  ('google oauth',            '{"user":{"app_metadata":{"provider":"google"},"user_metadata":{}}}'::jsonb),
  ('admin-created (marked)',  '{"user":{"app_metadata":{"provider":"email"},"user_metadata":{"consent_source":"admin"}}}'::jsonb),
  ('email + bogus string'  , '{"user":{"app_metadata":{"provider":"email"},"user_metadata":{"consent_required":"bogus"}}}'::jsonb)
) t(label, ev);

-- 5) Trigger wiring + function body uses the safe converters and the catch-all.
select tgname, tgenabled from pg_trigger
where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created_consent';
select position('consent_bool' in pg_get_functiondef('public.record_signup_consent'::regproc)) > 0 as uses_safe_bool,
       position('exception when others' in lower(pg_get_functiondef('public.record_signup_consent'::regproc))) > 0 as has_catch_all;

-- 6) Audit: users without a real consent record (e.g. API signups before/without the form).
select u.id, u.created_at, u.raw_app_meta_data->>'provider' as provider
from auth.users u
left join public.consent_records c on c.user_id = u.id and c.consent_required
where c.id is null
order by u.created_at desc;
