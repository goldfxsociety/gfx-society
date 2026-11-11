// PGlite (in-process Postgres) RLS/RPC checks for 20261111000000_academy_login_membership.sql.
// Local only; never points at a Supabase project. Sessions are PASSWORD sessions (auth.jwt amr = password).
// Run: node scripts/qa/pglite-academy-login-membership.mjs   (needs @electric-sql/pglite, e.g. npm i --no-save)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
const R = new URL('../../supabase/', import.meta.url).pathname;
const MIG = '20261111000000_academy_login_membership.sql';
const db = new PGlite({ extensions: { pgcrypto } });
process.on('unhandledRejection', (e) => { console.log('FAIL unexpected error:', e?.message); process.exit(1); });
let pass = 0, fail = 0;
const x = (s) => db.exec(s);
const as = async (role, uid, s) => { await x(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role ${role}`); try { return (await db.query(s)).rows; } finally { await x('reset role'); } };
const check = (ok, label, extra = '') => { if (ok) pass++; else fail++; console.log(ok ? 'PASS' : 'FAIL', label, ok ? '' : extra); };
const val = async (role, uid, s) => Object.values((await as(role, uid, s))[0])[0];
const expectVal = async (label, role, uid, s, want) => { try { const v = await val(role, uid, s); check(v === want, label, JSON.stringify(v)); } catch (e) { check(false, label, e.message); } };
const expectErr = async (label, role, uid, s, re) => { try { const r = await as(role, uid, s); check(false, label, 'no error: ' + JSON.stringify(r)); } catch (e) { check(re.test(e.message), label, e.message); } };

await x(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions; create schema storage;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true), 'amr', '[{"method":"password"}]'::jsonb) $$;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated; grant select,insert,delete on storage.objects to anon, authenticated; grant execute on function storage.foldername(text) to anon, authenticated;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated;
grant usage on schema public, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`);
// Members + courses chain as in prod (the reserve/finish migrations included), up to the new file.
for (const f of ['20261102120000_members_gate_allowlist.sql', '20261102130000_members_gate_email_otp.sql', '20261102140000_courses_payments.sql',
                 '20261102200000_member_code_atomic_reserve.sql', '20261102210000_member_code_tables_rls.sql', '20261102230000_drop_old_member_code_record.sql'])
  await x(fs.readFileSync(R + 'migrations/' + f, 'utf8'));

const VERIFY = fs.readFileSync(R + 'verification/20261111000000_academy_login_membership_verify.sql', 'utf8');
const verify = async () => (await db.query(VERIFY)).rows;

const U = { listed: '11111111-1111-1111-1111-111111111111', unconfirmed: '22222222-2222-2222-2222-222222222222', unlisted: '33333333-3333-3333-3333-333333333333',
            grace: '44444444-4444-4444-4444-444444444444', owner: '55555555-5555-5555-5555-555555555555', limiter: '66666666-6666-6666-6666-666666666666',
            blank: '77777777-7777-7777-7777-777777777777' };
await x(`insert into auth.users values
  ('${U.listed}','Listed@Example.test',now()), ('${U.unconfirmed}','unconfirmed@example.test',null), ('${U.unlisted}','unlisted@example.test',now()),
  ('${U.grace}','grace@example.test',now()), ('${U.owner}','owner@example.test',now()), ('${U.limiter}','limiter@example.test',now()),
  ('${U.blank}','  ',now())`);
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"unconfirmed@example.test","role":"client"},{"email":"grace@example.test","role":"ib"},{"email":"owner@example.test","role":"client"}]')`);

// ---- before: OTP-only state (the reason for this migration) ----
{
  const v = await verify();
  const want = new Set(['no session_is_otp in my_membership / record_member_consent', 'both require email_confirmed_at', 'record_member_consent has per-user claim limit',
                        'claim table private.member_claim_attempts exists, RLS on, no anon/authenticated privileges', 'member_status_select_own: own row, no OTP']);
  const bad = v.filter((r) => r.ok !== !want.has(r.check));
  check(bad.length === 0, 'verify BEFORE: only the OTP/claim rows are false', JSON.stringify(bad));
  await expectVal('BEFORE: password session, listed -> record_member_consent none (OTP-only)', 'authenticated', U.listed, `select public.record_member_consent('join-v2')`, 'none');
}

// ---- apply (twice: re-runnable) ----
const sql = fs.readFileSync(R + 'migrations/' + MIG, 'utf8');
try { await x(sql); await x(sql); check(true, 'migration applies twice'); } catch (e) { check(false, 'migration applies twice', e.message); process.exit(1); }
{ const v = await verify(); check(v.length >= 12 && v.every((r) => r.ok === true), 'verify AFTER: every row true', JSON.stringify(v.filter((r) => !r.ok))); }

{ const old = (await db.query(fs.readFileSync(R + 'verification/20261102130000_members_gate_email_otp_verify.sql', 'utf8'))).rows[0];
  check(old && old.bool_and === true, 'superseded OTP verify script still returns true after this migration', JSON.stringify(old)); }

// ---- privileges ----
await expectErr('anon cannot execute my_membership', 'anon', '', `select public.my_membership()`, /permission denied/);
await expectErr('anon cannot execute record_member_consent', 'anon', '', `select public.record_member_consent('join-v2')`, /permission denied/);
await expectErr('authenticated cannot read the allowlist', 'authenticated', U.listed, `select * from private.member_allowlist`, /permission denied/);
await expectErr('authenticated cannot read claim attempts', 'authenticated', U.listed, `select * from private.member_claim_attempts`, /permission denied/);
await expectErr('authenticated cannot call private.email_hash', 'authenticated', U.listed, `select private.email_hash('x')`, /permission denied/);
await expectErr('authenticated cannot write member_status directly', 'authenticated', U.listed, `insert into public.member_status(user_id,allowlist_status,consent_at) values ('${U.listed}','active',now())`, /permission denied/);
await expectErr('unknown consent version rejected', 'authenticated', U.listed, `select public.record_member_consent('join-v1')`, /unknown consent version/);
await expectVal('no session -> record_member_consent none', 'authenticated', '', `select public.record_member_consent('join-v2')`, 'none');
await expectVal('no session -> my_membership none', 'authenticated', '', `select public.my_membership()`, 'none');

// ---- unconfirmed / blank / unlisted ----
await expectVal('unconfirmed (listed) -> unverified_email', 'authenticated', U.unconfirmed, `select public.record_member_consent('join-v2')`, 'unverified_email');
await expectVal('unconfirmed -> membership none', 'authenticated', U.unconfirmed, `select public.my_membership()`, 'none');
await expectVal('blank email -> unverified_email', 'authenticated', U.blank, `select public.record_member_consent('join-v2')`, 'unverified_email');
await expectVal('confirmed unlisted -> no_match', 'authenticated', U.unlisted, `select public.record_member_consent('join-v2')`, 'no_match');
await expectVal('confirmed unlisted -> membership none', 'authenticated', U.unlisted, `select public.my_membership()`, 'none');
await expectVal('confirmed unlisted -> no member_status row', 'authenticated', U.unlisted, `select count(*)::int from public.member_status`, 0);

// ---- listed + consent (password session, mixed-case stored email) ----
await expectVal('listed, before consent -> membership none', 'authenticated', U.listed, `select public.my_membership()`, 'none');
await expectVal('listed + consent -> active', 'authenticated', U.listed, `select public.record_member_consent('join-v2')`, 'active');
await expectVal('listed + consent -> my_membership active', 'authenticated', U.listed, `select public.my_membership()`, 'active');
await expectVal('listed + consent -> is_member true', 'authenticated', U.listed, `select public.is_member()`, true);
await expectVal('own member_status row readable (no OTP), consent_version join-v2', 'authenticated', U.listed, `select consent_version from public.member_status`, 'join-v2');
await expectVal('cannot read another user\'s member_status', 'authenticated', U.unlisted, `select count(*)::int from public.member_status where user_id='${U.listed}'`, 0);
// Unconfirming the email later (e.g. pending change) removes membership even with a consent row.
await x(`update auth.users set email_confirmed_at = null where id='${U.listed}'`);
await expectVal('consented but email no longer confirmed -> none', 'authenticated', U.listed, `select public.my_membership()`, 'none');
await x(`update auth.users set email_confirmed_at = now() where id='${U.listed}'`);
// Changing the current email to an unlisted address -> not active (hash of current auth.users.email only).
await x(`update auth.users set email='other@example.test' where id='${U.listed}'`);
await expectVal('current email unlisted (status still active row) -> none', 'authenticated', U.listed, `select public.my_membership()`, 'none');
await x(`update auth.users set email='Listed@Example.test' where id='${U.listed}'`);

// ---- grace ----
await expectVal('grace user consents while listed -> active', 'authenticated', U.grace, `select public.record_member_consent('join-v2')`, 'active');
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"unconfirmed@example.test","role":"client"},{"email":"owner@example.test","role":"client"}]')`);
await expectVal('delisted -> grace within grace_until', 'authenticated', U.grace, `select public.my_membership()`, 'grace');
await expectVal('grace -> is_member true', 'authenticated', U.grace, `select public.is_member()`, true);
await x(`update public.member_status set grace_until = now() - interval '1 minute' where user_id='${U.grace}'`);
await expectVal('grace expired -> none', 'authenticated', U.grace, `select public.my_membership()`, 'none');
await x(`update public.member_status set allowlist_status='removed', grace_until=null where user_id='${U.grace}'`);
await expectVal('removed -> none', 'authenticated', U.grace, `select public.my_membership()`, 'none');
await expectVal('delisted re-consent -> no_match (no self-reactivation)', 'authenticated', U.grace, `select public.record_member_consent('join-v2')`, 'no_match');

// ---- S8: delisted owner with an approved purchase keeps access ----
await expectVal('owner consents while listed -> active', 'authenticated', U.owner, `select public.record_member_consent('join-v2')`, 'active');
await x(`insert into public.training_courses(slug,title,level,price_php,status,sales_open) values ('test-paid','Test','course',2000,'open',true);
insert into public.training_modules(course_id,sort,slug,title) select id,1,'m1','M1' from public.training_courses where slug='test-paid';
insert into public.training_lessons(module_id,sort,slug,title,status) select id,1,'l1','L1','published' from public.training_modules where slug='m1';
insert into public.course_purchases(user_id,course_id,price_php,amount_entered,payment_code,gcash_ref,receipt_sha256,status,decided_at)
  select '${U.owner}', id, 2000, 2000, 'GFX-T', '1234567890123', '${'a'.repeat(64)}', 'approved', now() from public.training_courses where slug='test-paid';`);
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"}]'); update public.member_status set grace_until = now() - interval '1 day' where user_id='${U.owner}'`);
await expectVal('S8 delisted owner: not a member', 'authenticated', U.owner, `select public.is_member()`, false);
await expectVal('S8 delisted owner: has_course_access true', 'authenticated', U.owner, `select public.has_course_access(id) from public.training_courses where slug='test-paid'`, true);
await expectVal('S8 delisted owner: my_payment_info approved', 'authenticated', U.owner, `select public.my_payment_info('test-paid')->>'state'`, 'approved');
await expectVal('S8 delisted owner: bought lessons readable', 'authenticated', U.owner, `select count(*)::int from public.training_lessons`, 1);
await expectVal('unlisted non-owner: my_payment_info not_member', 'authenticated', U.unlisted, `select public.my_payment_info('test-paid')->>'state'`, 'not_member');

// ---- per-user rate limit: 5/hour, 6th -> rate_limited (other users unaffected) ----
for (let i = 1; i <= 5; i++) await expectVal(`limiter attempt ${i} -> no_match`, 'authenticated', U.limiter, `select public.record_member_consent('join-v2')`, 'no_match');
await expectVal('limiter attempt 6 in an hour -> rate_limited', 'authenticated', U.limiter, `select public.record_member_consent('join-v2')`, 'rate_limited');
await expectVal('another user is not rate limited', 'authenticated', U.unlisted, `select public.record_member_consent('join-v2')`, 'no_match');
await x(`update private.member_claim_attempts set attempted_at = now() - interval '2 hours' where user_id='${U.limiter}'`);
await expectVal('after an hour -> allowed again', 'authenticated', U.limiter, `select public.record_member_consent('join-v2')`, 'no_match');

// ---- catalog: search_path pinned, no session_is_otp, SECURITY DEFINER ----
const fns = (await db.query(`select proname, prosecdef, proconfig, prosrc from pg_proc where oid in ('public.my_membership()'::regprocedure, 'public.record_member_consent(text)'::regprocedure)`)).rows;
check(fns.length === 2 && fns.every((f) => f.prosecdef), 'both SECURITY DEFINER');
check(fns.every((f) => JSON.stringify(f.proconfig) === JSON.stringify(['search_path=public, pg_temp'])), 'search_path pinned to public, pg_temp', JSON.stringify(fns.map((f) => f.proconfig)));
check(fns.every((f) => !f.prosrc.includes('session_is_otp')), 'no session_is_otp in either function');
check(fns.every((f) => !/auth\.jwt|user_metadata|raw_user_meta/.test(f.prosrc)), 'no JWT email / user_metadata used for authorization');
const pol = (await db.query(`select qual from pg_policies where schemaname='public' and tablename='member_status' and policyname='member_status_select_own'`)).rows;
check(pol.length === 1 && !pol[0].qual.includes('session_is_otp'), 'member_status_select_own has no OTP check', JSON.stringify(pol));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
