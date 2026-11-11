// PGlite (in-process Postgres) RLS/RPC checks for 20261111120000_access_requests.sql (access journey v2).
// Local only; never points at a Supabase project. Fake test emails only (example.test); nothing is printed but labels.
// Run: node scripts/qa/pglite-access-requests.mjs   (needs @electric-sql/pglite, e.g. npm i --no-save)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
const R = new URL('../../supabase/', import.meta.url).pathname;
const MIG = '20261111120000_access_requests.sql';
const db = new PGlite({ extensions: { pgcrypto } });
process.on('unhandledRejection', (e) => { console.log('FAIL unexpected error:', e?.message); process.exit(1); });
let pass = 0, fail = 0;
const x = (s) => db.exec(s);
const as = async (role, uid, s) => { await x(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role ${role}`); try { return (await db.query(s)).rows; } finally { await x('reset role'); } };
const check = (ok, label, extra = '') => { if (ok) pass++; else fail++; console.log(ok ? 'PASS' : 'FAIL', label, ok ? '' : extra); };
const val = async (role, uid, s) => Object.values((await as(role, uid, s))[0])[0];
const sval = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const expectVal = async (label, role, uid, s, want) => { try { const v = await val(role, uid, s); check(JSON.stringify(v) === JSON.stringify(want), label, JSON.stringify(v)); } catch (e) { check(false, label, e.message); } };
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
for (const f of ['20261102120000_members_gate_allowlist.sql', '20261102130000_members_gate_email_otp.sql', '20261102140000_courses_payments.sql',
                 '20261102200000_member_code_atomic_reserve.sql', '20261102210000_member_code_tables_rls.sql', '20261102230000_drop_old_member_code_record.sql',
                 '20261111000000_academy_login_membership.sql'])
  await x(fs.readFileSync(R + 'migrations/' + f, 'utf8'));

const VERIFY = fs.readFileSync(R + 'verification/20261111120000_access_requests_verify.sql', 'utf8');
const PREV_VERIFY = fs.readFileSync(R + 'verification/20261111000000_academy_login_membership_verify.sql', 'utf8');
{ const v = (await db.query(VERIFY)).rows; check(v.length >= 18 && v.filter((r) => r.ok).length < v.length / 2, 'verify BEFORE: mostly false (objects missing)', JSON.stringify(v.filter((r) => r.ok).map((r) => r.check))); }

const sql = fs.readFileSync(R + 'migrations/' + MIG, 'utf8');
try { await x(sql); await x(sql); check(true, 'migration applies twice (re-runnable)'); } catch (e) { check(false, 'migration applies twice', e.message); process.exit(1); }
{ const v = (await db.query(VERIFY)).rows; check(v.length >= 18 && v.every((r) => r.ok === true), 'verify AFTER: every row true', JSON.stringify(v.filter((r) => !r.ok))); }
{ const v = (await db.query(PREV_VERIFY)).rows; check(v.every((r) => r.ok === true), 'PR66 verify still all true after this migration', JSON.stringify(v.filter((r) => !r.ok))); }

const U = { listed: '11111111-1111-1111-1111-111111111111', a: '22222222-2222-2222-2222-222222222222', b: '33333333-3333-3333-3333-333333333333',
            unconf: '44444444-4444-4444-4444-444444444444', lim: '55555555-5555-5555-5555-555555555555', nocon: '66666666-6666-6666-6666-666666666666',
            late: '77777777-7777-7777-7777-777777777777', ip: '88888888-8888-8888-8888-888888888888', link: '99999999-9999-9999-9999-999999999999' };
await x(`insert into auth.users values
  ('${U.listed}','listed@example.test',now()), ('${U.a}','alice@example.test',now()), ('${U.b}','bob@example.test',now()),
  ('${U.unconf}','unconf@example.test',null), ('${U.lim}','lim@example.test',now()), ('${U.nocon}','nocon@example.test',now()),
  ('${U.late}','late@example.test',now()), ('${U.ip}','ip@example.test',now()), ('${U.link}','academy-link@example.test',now())`);
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"}]')`);
const sub = (accm, ib = null, v = 'request-v1', ip = '203.0.113.1') =>
  `select public.submit_access_request(${accm === null ? 'null' : `'${accm}'`}, ${ib === null ? 'null' : `'${ib.replace(/'/g, "''")}'`}, '${v}', '${ip}')`;
const consent = `select public.record_member_consent('join-v2')`;

// ---- privileges / RLS ----
await expectErr('anon cannot submit_access_request', 'anon', '', sub(null), /permission denied/);
await expectErr('anon cannot my_join_state', 'anon', '', `select public.my_join_state()`, /permission denied/);
await expectErr('authenticated cannot issue a confirm token (would bypass the mailbox)', 'authenticated', U.a, `select public.issue_accm_confirm_token('${U.a}')`, /permission denied/);
await expectErr('anon cannot issue a confirm token', 'anon', '', `select public.issue_accm_confirm_token('${U.a}')`, /permission denied/);
for (const t of ['public.access_requests', 'private.access_request_accm', 'private.access_request_attempts', 'private.accm_confirm_sends', 'private.member_join_consent']) {
  await expectErr(`authenticated cannot select ${t}`, 'authenticated', U.a, `select * from ${t}`, /permission denied/);
  await expectErr(`anon cannot select ${t}`, 'anon', '', `select * from ${t}`, /permission denied/);
}
await expectErr('authenticated cannot insert access_requests directly', 'authenticated', U.a, `insert into public.access_requests(user_id,academy_email_hash,consent_version,status) values ('${U.a}','${'a'.repeat(64)}','request-v1','matched')`, /permission denied/);
await expectErr('authenticated cannot update access_requests directly', 'authenticated', U.a, `update public.access_requests set status='matched'`, /permission denied/);
await expectErr('authenticated cannot run the refresh matcher', 'authenticated', U.a, `select private.match_access_requests()`, /permission denied/);
await expectErr('unknown request consent version rejected', 'authenticated', U.a, sub(null, null, 'request-v0'), /unknown consent version/);
await expectVal('no session -> none', 'authenticated', '', sub(null), 'none');
await expectVal('no session -> my_join_state null', 'authenticated', '', `select public.my_join_state()`, null);

// ---- server re-checks ----
await expectVal('unconfirmed email -> unverified_email', 'authenticated', U.unconf, sub(null), 'unverified_email');
await expectVal('no join-v2 consent yet -> join_consent_required', 'authenticated', U.nocon, sub(null), 'join_consent_required');
await expectVal('listed member: consent -> active', 'authenticated', U.listed, consent, 'active');
await expectVal('already a member -> already_member (no row)', 'authenticated', U.listed, sub(null), 'already_member');

// ---- remembered consent ----
await expectVal('alice: consent before -> false', 'authenticated', U.a, `select (public.my_join_state()->>'consent')::boolean`, false);
await expectVal('alice: unlisted consent -> no_match', 'authenticated', U.a, consent, 'no_match');
await expectVal('alice: join-v2 consent remembered after no_match', 'authenticated', U.a, `select (public.my_join_state()->>'consent')::boolean`, true);
await expectVal('alice: still not a member', 'authenticated', U.a, `select public.my_membership()`, 'none');

// ---- validation (does not count toward the rate limit) ----
await expectVal('invalid ACCM email -> invalid_email', 'authenticated', U.a, sub('not-an-email'), 'invalid_email');
await expectVal('ACCM email > 254 chars -> invalid_email', 'authenticated', U.a, sub('a'.repeat(250) + '@x.test'), 'invalid_email');
await expectVal('ACCM email = Academy email (case/space) -> same_email', 'authenticated', U.a, sub('  ALICE@example.test '), 'same_email');

// ---- submit, consent only -> one pending row ----
await expectVal('alice submit (no ACCM email) -> pending', 'authenticated', U.a, sub(null, 'Sub IB https://evil.test/x www.spam.test Juan dela Cruz evil.com'), 'pending');
await expectVal('alice: my_join_state request pending', 'authenticated', U.a, `select public.my_join_state()->'request'->>'status'`, 'pending');
await expectVal('IB name: URLs / domains stripped, text kept', 'authenticated', U.a, `select public.my_join_state()->'request'->>'ib_name'`, 'Sub IB Juan dela Cruz');
check((await sval(`select count(*)::int from public.access_requests where user_id='${U.a}'`)) === 1, 'one row for alice');
check((await sval(`select count(*)::int from public.access_requests where academy_email_hash ~ '^[0-9a-f]{64}$' and user_id='${U.a}'`)) === 1, 'Academy email stored as hash only');
check((await sval(`select count(*)::int from information_schema.columns where table_schema='public' and table_name='access_requests' and column_name like '%email' and column_name not like '%hash'`)) === 0, 'no plaintext email column on access_requests');
await expectVal('alice second submit updates the same row -> pending', 'authenticated', U.a, sub(null, 'Team Ana'), 'pending');
check((await sval(`select count(*)::int from public.access_requests where user_id='${U.a}'`)) === 1, 'second submit: still one row (no second active row)');
let dup = false; try { await x(`insert into public.access_requests(user_id,academy_email_hash,consent_version,status) values ('${U.a}','${'b'.repeat(64)}','request-v1','pending')`); } catch { dup = true; }
check(dup, 'unique partial index blocks a second active row even for the table owner');
await expectVal('cross-user: bob sees no request of alice', 'authenticated', U.b, `select public.my_join_state()->'request'`, null);

// ---- rate limit: 3 per user / 24 h ----
await expectVal('alice 3rd submit -> pending', 'authenticated', U.a, sub(null, 'Team Ana'), 'pending');
await expectVal('alice 4th submit in 24 h -> rate_limited', 'authenticated', U.a, sub(null, 'Team Ana'), 'rate_limited');
await x(`update private.access_request_attempts set attempted_at = now() - interval '25 hours' where user_id='${U.a}'`);
await expectVal('after 24 h -> allowed again', 'authenticated', U.a, sub(null, 'Team Ana'), 'pending');
// per IP: 10 / 24 h across users
for (const id of [U.b, U.lim, U.ip, U.late]) await as('authenticated', id, consent);
await x(`delete from private.access_request_attempts`);
const ipSeq = [U.b, U.b, U.b, U.lim, U.lim, U.lim, U.late, U.late, U.late, U.ip];
for (const id of ipSeq) await as('authenticated', id, sub(null, null, 'request-v1', '198.51.100.7'));
await expectVal('11th submit from the same IP in 24 h -> rate_limited', 'authenticated', U.ip, sub(null, null, 'request-v1', '198.51.100.7'), 'rate_limited');
await expectVal('same user, other IP -> allowed', 'authenticated', U.ip, sub(null, null, 'request-v1', '198.51.100.8'), 'pending');
check((await sval(`select count(*)::int from private.access_request_attempts where ip_hash like '%198.51%'`)) === 0, 'IP stored only as hash');
await x(`delete from private.access_request_attempts`);

// ---- different ACCM email: awaiting until the link is clicked ----
await as('authenticated', U.link, consent);
await expectVal('link user submit with ACCM email -> awaiting_email_confirm', 'authenticated', U.link, sub('ACCM-Link@Example.test'), 'awaiting_email_confirm');
check((await sval(`select accm_email from private.access_request_accm s join public.access_requests r on r.id=s.request_id where r.user_id='${U.link}'`)) === 'accm-link@example.test', 'raw ACCM email kept only in private (normalized) while awaiting');
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"accm-link@example.test","role":"client"}]')`);
await expectVal('refresh: an UNCONFIRMED ACCM address is never checked/linked (still awaiting)', 'authenticated', U.link, `select public.my_join_state()->'request'->>'status'`, 'awaiting_email_confirm');
await expectVal('refresh: unconfirmed link user not a member', 'authenticated', U.link, `select public.my_membership()`, 'none');
// token issue (service role only) + confirm
const issueJ = async (uid) => { await x('set role service_role'); try { return (await db.query(`select public.issue_accm_confirm_token('${uid}') as j`)).rows[0].j; } finally { await x('reset role'); } };
const t1 = await issueJ(U.link);
check(/^[0-9a-f]{64}$/.test(t1.token) && t1.email === 'accm-link@example.test', 'service role gets a 64-hex token + the ACCM address for the mailer');
check((await sval(`select count(*)::int from private.access_request_accm where token_hash = '${t1.token}'`)) === 0, 'raw token is not stored (hash only)');
const t2 = await issueJ(U.link);
await expectVal('older token stops working once a new one is issued', 'anon', '', `select public.confirm_accm_email('${t1.token}')`, 'invalid');
const t3 = await issueJ(U.link);
check((await issueJ(U.link)).error === 'rate_limited', '4th confirmation email for a request in 24 h -> rate_limited');
check((await issueJ(U.b)).error === 'none', 'no awaiting request -> none (no token)');
void t2;
await expectVal('malformed token -> invalid', 'anon', '', `select public.confirm_accm_email('../../etc')`, 'invalid');
await expectVal('unknown token -> invalid (same answer)', 'anon', '', `select public.confirm_accm_email('${'0'.repeat(64)}')`, 'invalid');
await x(`update private.access_request_accm set token_expires_at = now() - interval '1 second' where token_hash = encode(extensions.digest('${t3.token}','sha256'),'hex')`);
await expectVal('expired token (24 h) -> invalid', 'anon', '', `select public.confirm_accm_email('${t3.token}')`, 'invalid');
await x(`delete from private.accm_confirm_sends`);
const t4 = await issueJ(U.link);
await expectVal('valid token (clicked logged out) -> confirmed', 'anon', '', `select public.confirm_accm_email('${t4.token}')`, 'confirmed');
await expectVal('confirmed -> request pending', 'authenticated', U.link, `select public.my_join_state()->'request'->>'status'`, 'pending');
check((await sval(`select count(*)::int from private.access_request_accm s join public.access_requests r on r.id=s.request_id where r.user_id='${U.link}' and s.accm_email is null`)) === 1, 'raw ACCM email removed once confirmed');
await expectVal('re-opening the used link -> confirmed again, no change', 'anon', '', `select public.confirm_accm_email('${t4.token}')`, 'confirmed');
check((await issueJ(U.link)).error === 'none', 'no new token after confirmation');
// update with same confirmed ACCM email keeps it confirmed; a changed one needs a new confirmation
await expectVal('update with the same (confirmed) ACCM email -> pending', 'authenticated', U.link, sub('accm-link@example.test', 'Team B'), 'pending');
await expectVal('still confirmed', 'authenticated', U.link, `select (public.my_join_state()->'request'->>'accm_confirmed')::boolean`, true);
await expectVal('changed ACCM email -> awaiting again', 'authenticated', U.link, sub('other-accm@example.test'), 'awaiting_email_confirm');
await expectVal('changed: no longer confirmed', 'authenticated', U.link, `select (public.my_join_state()->'request'->>'accm_confirmed')::boolean`, false);
await x(`delete from private.access_request_attempts; delete from private.accm_confirm_sends`);
await expectVal('back to the listed ACCM email -> awaiting (must confirm again)', 'authenticated', U.link, sub('accm-link@example.test'), 'awaiting_email_confirm');
const t5 = await issueJ(U.link);
await expectVal('confirm again -> confirmed', 'anon', '', `select public.confirm_accm_email('${t5.token}')`, 'confirmed');

// ---- monthly refresh ----
await x(`update auth.users set email='late@example.test' where id='${U.late}'`);
const r1 = await sval(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"accm-link@example.test","role":"client"}]')`);
check(r1.requests_matched === 1 && typeof r1.requests_pending === 'number' && !JSON.stringify(r1).includes('@'), 'refresh returns counts only (1 matched)', JSON.stringify(r1));
await expectVal('refresh: confirmed ACCM email match -> matched', 'authenticated', U.link, `select public.my_join_state()->'request'->>'status'`, 'matched');
await expectVal('refresh: linked user is now active (via ACCM email)', 'authenticated', U.link, `select public.my_membership()`, 'active');
check((await sval(`select count(*)::int from public.access_requests where user_id='${U.link}' and status='matched' and matched_via='accm' and matched_at is not null`)) === 1, 'matched row kept, matched_via accm');
await expectVal('no-match refresh: alice still pending (no expiry)', 'authenticated', U.a, `select public.my_join_state()->'request'->>'status'`, 'pending');
const rc0 = await sval(`select refresh_checks from public.access_requests where user_id='${U.a}'`);
check(rc0 >= 1 && (await sval(`select last_checked_at is not null from public.access_requests where user_id='${U.a}'`)) === true, 'no-match: refresh_checks + last_checked_at recorded');
// many refreshes later still active, never expired
for (let i = 0; i < 4; i++) await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"accm-link@example.test","role":"client"}]')`);
check((await sval(`select status || ':' || refresh_checks from public.access_requests where user_id='${U.a}'`)) === `pending:${rc0 + 4}`, '4 more refreshes: still pending, each one counted');
// Academy email added at a later refresh -> matched with remembered consent
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"accm-link@example.test","role":"client"},{"email":"alice@example.test","role":"ib"}]')`);
await expectVal('alice matched at refresh -> active (no re-submit, no re-consent)', 'authenticated', U.a, `select public.my_membership()`, 'active');
check((await sval(`select consent_version || ':' || role from public.member_status where user_id='${U.a}'`)) === 'join-v2:ib', 'member_status added with join-v2 consent + role');
// delist linked member -> grace; relist -> active
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"alice@example.test","role":"ib"}]')`);
await expectVal('linked member delisted -> grace', 'authenticated', U.link, `select public.my_membership()`, 'grace');
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"alice@example.test","role":"ib"},{"email":"accm-link@example.test","role":"client"}]')`);
await expectVal('linked member relisted -> active', 'authenticated', U.link, `select public.my_membership()`, 'active');
check((await sval(`select count(*)::int from public.member_status where user_id='${U.listed}' and allowlist_status='active'`)) === 1, 'directly listed member untouched by request logic');

// ---- submit-time check against the already-loaded allowlist (§12.1 A) ----
await expectVal('bob consent while unlisted -> no_match', 'authenticated', U.b, consent, 'no_match');
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"alice@example.test","role":"ib"},{"email":"accm-link@example.test","role":"client"},{"email":"bob@example.test","role":"client"}]')`);
await x(`delete from private.access_request_attempts`);
await expectVal('bob refresh matched his pending request -> active', 'authenticated', U.b, `select public.my_membership()`, 'active');
// a consented, now-listed user with no member_status row submits -> matched at submit (no ACCM pull)
await x(`insert into auth.users values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','newly@example.test',now())`);
await as('authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', consent);
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"alice@example.test","role":"ib"},{"email":"accm-link@example.test","role":"client"},{"email":"bob@example.test","role":"client"},{"email":"newly@example.test","role":"client"}]')`);
await expectVal('consented + listed after verify, submit -> matched', 'authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', sub(null), 'matched');
await expectVal('-> active', 'authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', `select public.my_membership()`, 'active');

// ---- account deletion removes the request rows ----
const before = await sval(`select count(*)::int from public.access_requests where user_id='${U.link}'`);
await x(`delete from auth.users where id='${U.link}'`);
check(before >= 1 && (await sval(`select count(*)::int from public.access_requests where user_id='${U.link}'`)) === 0
  && (await sval(`select count(*)::int from private.access_request_accm`)) === 0, 'deleting the auth user cascades to access_requests + private rows');

// ---- grace/removed rules intact for non-request members ----
await x(`select private.import_allowlist('[{"email":"alice@example.test","role":"ib"}]')`);
await expectVal('directly listed member delisted -> grace', 'authenticated', U.listed, `select public.my_membership()`, 'grace');
await x(`update public.member_status set grace_until = now() - interval '1 minute' where user_id='${U.listed}'`);
await expectVal('grace expired -> none', 'authenticated', U.listed, `select public.my_membership()`, 'none');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
