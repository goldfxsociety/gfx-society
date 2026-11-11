// PGlite (in-process Postgres) checks for 20261111130000_accm_confirm_mailer.sql, applied on top of an
// ALREADY-applied 20261111120000_access_requests.sql (PR #67 deploys first). Local only; never points at a Supabase
// project. Fake test emails only (example.test); only labels are printed, never tokens or emails.
// Run: node scripts/qa/pglite-accm-confirm-mailer.mjs   (needs @electric-sql/pglite, e.g. npm i --no-save)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
const R = new URL('../../supabase/', import.meta.url).pathname;
const db = new PGlite({ extensions: { pgcrypto } });
process.on('unhandledRejection', (e) => { console.log('FAIL unexpected error:', e?.message); process.exit(1); });
let pass = 0, fail = 0;
const x = (s) => db.exec(s);
const as = async (role, uid, s) => { await x(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role ${role}`); try { return (await db.query(s)).rows; } finally { await x('reset role'); } };
const check = (ok, label, extra = '') => { if (ok) pass++; else fail++; console.log(ok ? 'PASS' : 'FAIL', label, ok ? '' : extra); };
const val = async (role, uid, s) => Object.values((await as(role, uid, s))[0])[0];
const sval = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const expectVal = async (label, role, uid, s, want) => { try { const v = await val(role, uid, s); check(JSON.stringify(v) === JSON.stringify(want), label, JSON.stringify(v)); } catch (e) { check(false, label, e.message); } };
const expectErr = async (label, role, uid, s, re) => { try { await as(role, uid, s); check(false, label, 'no error'); } catch (e) { check(re.test(e.message), label, e.message); } };

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
                 '20261111000000_academy_login_membership.sql', '20261111120000_access_requests.sql'])
  await x(fs.readFileSync(R + 'migrations/' + f, 'utf8'));

const U = { a: '22222222-2222-2222-2222-222222222222', b: '33333333-3333-3333-3333-333333333333', abuse: '44444444-4444-4444-4444-444444444444',
            link: '99999999-9999-9999-9999-999999999999', aw: '55555555-5555-5555-5555-555555555555' };
await x(`insert into auth.users values ('${U.a}','alice@example.test',now()), ('${U.b}','bob@example.test',now()),
  ('${U.abuse}','abuse@example.test',now()), ('${U.link}','academy-link@example.test',now()), ('${U.aw}','awaiting@example.test',now())`);
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"}]')`);
const sub = (accm, ip = '203.0.113.1') => `select public.submit_access_request(${accm === null ? 'null' : `'${accm}'`}, null, 'request-v1', '${ip}')`;
const consent = `select public.record_member_consent('join-v2')`;
for (const id of Object.values(U)) await as('authenticated', id, consent);

// Pre-state on a PR67-only DB: the N3 hole (direct RPC stores a raw ACCM email).
await expectVal('PR67 only: direct RPC with ACCM email -> awaiting (the N3 hole)', 'authenticated', U.abuse, sub('abuse-accm@example.test'), 'awaiting_email_confirm');
check((await sval(`select count(*)::int from private.access_request_accm where accm_email is not null`)) === 1, 'PR67 only: raw ACCM email stored');

const VERIFY = fs.readFileSync(R + 'verification/20261111130000_accm_confirm_mailer_verify.sql', 'utf8');
{
  // Q6: the verify header names exactly which rows are already true before applying (here the N3 hole row exists,
  // so the two 'N3 guard holds now' rows are false, as the header says).
  const v = (await db.query(VERIFY)).rows;
  const pre = v.filter((r) => r.ok).map((r) => r.check.split(/[:(]| \.\.\./)[0].trim());
  const want = ['Q6 private.app_settings exists', 'Q6 anon/authenticated', 'only issue_accm_confirm_token creates a raw token',
    'N5 raw ACCM email is cleared on confirm', 'N5 member_hashes', 'refresh matcher still not executable by anon/authenticated',
    'redefined public RPCs keep SECURITY DEFINER + search_path=public, pg_temp', 'Q2 holds now'];
  check(JSON.stringify(pre) === JSON.stringify(want), `verify BEFORE: exactly the ${want.length} rows the header lists are true`, JSON.stringify(pre));
  const hdr = VERIFY.slice(0, VERIFY.indexOf('with f as'));
  check(want.every((w) => hdr.includes(`'${w.split(' ').slice(0, 3).join(' ')}`)), 'verify header names every pre-apply true row');
}
const sql = fs.readFileSync(R + 'migrations/20261111130000_accm_confirm_mailer.sql', 'utf8');
try { await x(sql); await x(sql); check(true, 'migration applies twice on top of applied PR67 (re-runnable)'); } catch (e) { check(false, 'migration applies twice', e.message); process.exit(1); }
{ const v = (await db.query(VERIFY)).rows; check(v.length === 20 && v.every((r) => r.ok === true), `verify AFTER: all ${v.length} rows true`, JSON.stringify(v.filter((r) => !r.ok))); }
for (const f of ['20261111120000_access_requests_verify.sql', '20261111000000_academy_login_membership_verify.sql']) {
  const v = (await db.query(fs.readFileSync(R + 'verification/' + f, 'utf8'))).rows;
  const bad = v.filter((r) => !r.ok).map((r) => r.check);
  // PR67's verify expects anon to execute confirm_accm_email; N1 removes that on purpose.
  check(bad.every((c) => /confirm_accm_email: anon/.test(c)), `${f}: still true except the intended N1 anon change`, JSON.stringify(bad));
}

// ---- N3 cleanup + guard (switch off) ----
check((await sval(`select count(*)::int from private.access_request_accm where accm_email is not null`)) === 0, 'cleanup: raw ACCM email deleted while switch is off');
await expectVal('cleanup: abused request back to pending', 'authenticated', U.abuse, `select public.my_join_state()->'request'->>'status'`, 'pending');
await expectVal('cleanup: no ACCM hash left on it', 'authenticated', U.abuse, `select (public.my_join_state()->'request'->>'has_accm_email')::boolean`, false);
await expectVal('N3: switch off -> ACCM email refused', 'authenticated', U.a, sub('alice-accm@example.test'), 'accm_email_disabled');
check((await sval(`select count(*)::int from private.access_request_accm`)) === 0 && (await sval(`select count(*)::int from public.access_requests where status='awaiting_email_confirm'`)) === 0, 'N3: nothing stored, no awaiting state');
check((await sval(`select count(*)::int from private.access_request_attempts where user_id='${U.a}'`)) === 0, 'N3: refused call does not use a try');
await expectVal('switch off: request without ACCM email still works', 'authenticated', U.a, sub(null), 'pending');
const issueJ = async (uid) => { await x('set role service_role'); try { return (await db.query(`select public.issue_accm_confirm_token('${uid}') as j`)).rows[0].j; } finally { await x('reset role'); } };
check((await issueJ(U.a)).error === 'none', 'switch off: issue_accm_confirm_token issues nothing');
await expectVal('switch off: confirm -> invalid', 'authenticated', U.a, `select public.confirm_accm_email('${'a'.repeat(64)}')`, 'invalid');
await expectErr('private switch reader not callable by authenticated', 'authenticated', U.a, `select private.accm_confirm_mail_live()`, /permission denied/);
await expectErr('authenticated cannot flip the switch', 'authenticated', U.a, `update private.app_settings set value='true' where key='accm_confirm_mail_live'`, /permission denied/);
await expectErr('authenticated still cannot issue a token', 'authenticated', U.a, `select public.issue_accm_confirm_token('${U.a}')`, /permission denied/);

// ---- switch on (go-live simulation) ----
await x(`update private.app_settings set value='true' where key='accm_confirm_mail_live'`);
await x(sql); // re-run with the switch on: no cleanup, switch value kept
check((await sval(`select value from private.app_settings where key='accm_confirm_mail_live'`)) === 'true', 're-run keeps the switch value (on conflict do nothing)');
await expectVal('switch on: ACCM email -> awaiting', 'authenticated', U.link, sub('accm-link@example.test'), 'awaiting_email_confirm');
check((await sval(`select count(*)::int from private.access_request_accm where accm_email is not null`)) === 1, 're-run with switch on: no cleanup of a live awaiting row');
const t1 = await issueJ(U.link);
check(/^[0-9a-f]{64}$/.test(t1.token) && t1.email === 'accm-link@example.test', 'service role gets token + address');
// N1
await expectErr('N1: anon cannot call confirm at all', 'anon', '', `select public.confirm_accm_email('${t1.token}')`, /permission denied/);
await expectVal('N1: no session (authenticated role, no sub) -> invalid', 'authenticated', '', `select public.confirm_accm_email('${t1.token}')`, 'invalid');
await expectVal('N1: other signed-in account -> invalid (neutral)', 'authenticated', U.b, `select public.confirm_accm_email('${t1.token}')`, 'invalid');
await expectVal('N1: unknown token -> same invalid (no account oracle)', 'authenticated', U.b, `select public.confirm_accm_email('${'0'.repeat(64)}')`, 'invalid');
check((await sval(`select count(*)::int from private.access_request_accm where token_used_at is null and accm_email is not null`)) === 1, 'N1: mismatch did not consume the token');
await expectVal('N1: requester -> confirmed', 'authenticated', U.link, `select public.confirm_accm_email('${t1.token}')`, 'confirmed');
check((await sval(`select count(*)::int from private.access_request_accm where accm_email is not null`)) === 0, 'N5: raw ACCM email cleared on confirm');
await expectVal('N1: re-open by requester -> confirmed', 'authenticated', U.link, `select public.confirm_accm_email('${t1.token}')`, 'confirmed');
await expectVal('N1: re-open by another account -> invalid', 'authenticated', U.b, `select public.confirm_accm_email('${t1.token}')`, 'invalid');
await expectVal('confirmed -> pending', 'authenticated', U.link, `select public.my_join_state()->'request'->>'status'`, 'pending');
// rate limit unchanged: 3 sends / request / 24 h
await expectVal('aw user: ACCM email -> awaiting', 'authenticated', U.aw, sub('aw-accm@example.test'), 'awaiting_email_confirm');
for (let i = 0; i < 3; i++) await issueJ(U.aw);
check((await issueJ(U.aw)).error === 'rate_limited', '4th send in 24 h -> rate_limited');

// ---- N2: refresh checks the Academy email of an awaiting request; never the unconfirmed ACCM address ----
const r0 = await sval(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"aw-accm@example.test","role":"client"}]')`);
await expectVal('N2: unconfirmed ACCM address on list -> still awaiting (not linked)', 'authenticated', U.aw, `select public.my_join_state()->'request'->>'status'`, 'awaiting_email_confirm');
await expectVal('N2: not a member via unconfirmed address', 'authenticated', U.aw, `select public.my_membership()`, 'none');
check((await sval(`select refresh_checks from public.access_requests where user_id='${U.aw}'`)) === 1 && typeof r0.requests_pending === 'number', 'N2: awaiting request is checked and counted');
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"awaiting@example.test","role":"ib"}]')`);
await expectVal('N2: Academy email listed -> awaiting request matched', 'authenticated', U.aw, `select public.my_join_state()->'request'->>'status'`, 'matched');
await expectVal('N2: -> active', 'authenticated', U.aw, `select public.my_membership()`, 'active');
check((await sval(`select count(*)::int from private.access_request_accm s join public.access_requests r on r.id=s.request_id where r.user_id='${U.aw}' and s.accm_email is not null`)) === 0, 'N2: raw unconfirmed ACCM address dropped on Academy match');
check((await sval(`select matched_via from public.access_requests where user_id='${U.aw}'`)) === 'academy', 'N2: matched_via academy');
// N5: confirmed Academy email lands in member_hashes; unconfirmed does not
await x(`insert into auth.users values ('66666666-6666-6666-6666-666666666666','unconf@example.test',null)`);
check((await sval(`select count(*)::int from private.member_hashes('${U.a}')`)) === 1, 'N5: confirmed Academy email is in member_hashes');
check((await sval(`select count(*)::int from private.member_hashes('66666666-6666-6666-6666-666666666666')`)) === 0, 'N5: unconfirmed Academy email is not');
// confirmed ACCM email still links at refresh
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"},{"email":"awaiting@example.test","role":"ib"},{"email":"accm-link@example.test","role":"client"}]')`);
await expectVal('confirmed ACCM email matched at refresh -> active', 'authenticated', U.link, `select public.my_membership()`, 'active');

// ---- Q5: plain addr-spec only (switch on) ----
const Q = { five: 'aaaa0005-0000-0000-0000-000000000005', p1: 'aaaa0001-0000-0000-0000-000000000001', p2: 'aaaa0002-0000-0000-0000-000000000002',
            p3: 'aaaa0003-0000-0000-0000-000000000003', p4: 'aaaa0004-0000-0000-0000-000000000004' };
await x(`insert into auth.users values ('${Q.five}','five@example.test',now()), ('${Q.p1}','p1@example.test',now()), ('${Q.p2}','p2@example.test',now()),
  ('${Q.p3}','p3@example.test',now()), ('${Q.p4}','p4@example.test',now())`);
for (const id of Object.values(Q)) await as('authenticated', id, consent);
const subRaw = (accm) => `select public.submit_access_request(${accm}, null, 'request-v1', '203.0.113.9')`;
for (const [label, lit] of [['display name', `'Name<a@example.test>'`], ['angle brackets', `'<a@example.test>'`], ['double quotes', `'"a"@example.test'`],
                            ['single quote', `'a''b@example.test'`], ['comma', `'a,b@example.test'`], ['space', `'a b@example.test'`],
                            ['CR/LF', `E'a@example.test\\r\\nbcc@example.test'`], ['semicolon', `'a;b@example.test'`], ['no dot in domain', `'a@localhost'`]]) {
  await x(`delete from private.access_request_attempts`);
  await expectVal(`Q5 SQL rejects ${label}`, 'authenticated', Q.five, subRaw(lit), 'invalid_email');
}
check((await sval(`select count(*)::int from private.access_request_accm s join public.access_requests r on r.id=s.request_id where r.user_id='${Q.five}'`)) === 0, 'Q5: nothing stored for rejected addresses');
await expectVal('Q5 SQL accepts a plain addr-spec (dots, plus, subdomain)', 'authenticated', Q.five, subRaw(`'First.Last+tag@mail.example-co.test'`), 'awaiting_email_confirm');

// ---- Q2: purge a raw ACCM email that is never confirmed ----
const rawCount = async (uid) => sval(`select count(*)::int from private.access_request_accm s join public.access_requests r on r.id=s.request_id where r.user_id='${uid}' and s.accm_email is not null`);
const age = async (uid, days, tokenExpiredDays = null) => {
  await x(`update public.access_requests set updated_at = now() - interval '${days} days' where user_id='${uid}' and status='awaiting_email_confirm'`);
  if (tokenExpiredDays !== null) await x(`update private.access_request_accm s set token_expires_at = now() + interval '${tokenExpiredDays} days' from public.access_requests r where r.id=s.request_id and r.user_id='${uid}'`);
};
for (const id of [Q.p1, Q.p2, Q.p3, Q.p4]) { await x(`delete from private.access_request_attempts`); await as('authenticated', id, sub(`${id.slice(0, 8)}-accm@example.test`)); }
await x(`delete from private.accm_confirm_sends`);
await issueJ(Q.p1); await issueJ(Q.p2);
await age(Q.p1, 8, -1);    // > 7 days, token expired      -> purge
await age(Q.p2, 8, 1);     // > 7 days, token still valid  -> keep
await age(Q.p3, 6);        // < 7 days, never had a token  -> keep
await age(Q.p4, 8);        // > 7 days, never had a token  -> purge (cron path below)
const hashBefore = await sval(`select accm_email_hash from public.access_requests where user_id='${Q.p1}'`);
await x(`delete from private.access_request_attempts`);
await as('authenticated', U.b, sub(null)); // any submit runs the per-call purge
check((await rawCount(Q.p1)) === 0, 'Q2 per-call purge (submit): >7 days + no unexpired token -> raw ACCM email deleted');
check((await sval(`select accm_email_hash from public.access_requests where user_id='${Q.p1}'`)) === hashBefore && hashBefore !== null, 'Q2: the hash stays with the request');
await expectVal('Q2: request leaves awaiting_email_confirm -> pending (Academy email only)', 'authenticated', Q.p1, `select public.my_join_state()->'request'->>'status'`, 'pending');
await expectVal('Q2: unconfirmed hash never counts', 'authenticated', Q.p1, `select (public.my_join_state()->'request'->>'accm_confirmed')::boolean`, false);
check((await rawCount(Q.p2)) === 1, 'Q2: kept while an unexpired token remains');
check((await rawCount(Q.p3)) === 1, 'Q2: kept while younger than 7 days');
check((await rawCount(Q.p4)) === 0, 'Q2: no-token row older than 7 days also purged by the same call');
// cron path + refresh path
await age(Q.p2, 8, -1);
await x('set role service_role');
const cron = (await db.query(`select public.purge_member_gate_logs() as j`)).rows[0].j;
await x('reset role');
check(cron.stale_accm_emails === 1 && 'code_requests' in cron && (await rawCount(Q.p2)) === 0, 'Q2 daily cron purge (purge_member_gate_logs, service role) deletes it and reports a count only', JSON.stringify(cron));
await expectErr('Q2: authenticated cannot run the purge', 'authenticated', Q.p3, `select private.purge_stale_accm_emails()`, /permission denied/);
await expectErr('Q2: authenticated cannot run the cron purge', 'authenticated', Q.p3, `select public.purge_member_gate_logs()`, /permission denied/);
await age(Q.p3, 8);
await x(`select private.import_allowlist('[{"email":"listed@example.test","role":"client"}]')`);
check((await rawCount(Q.p3)) === 0, 'Q2 refresh path (import_allowlist -> match_access_requests) purges too');
await expectVal('Q2: after purge the user can update the request with an ACCM email again -> awaiting', 'authenticated', Q.p1,
  (await x(`delete from private.access_request_attempts`), sub(`${Q.p1.slice(0, 8)}-accm@example.test`)), 'awaiting_email_confirm');
check((await rawCount(Q.p1)) === 1, 'Q2: re-entered address stored again for a fresh confirmation');

// ---- R3: the purge path inside issue_accm_confirm_token (service role, no submit, no cron) ----
for (const id of [Q.p3, Q.p4]) { await x(`delete from private.access_request_attempts`); await as('authenticated', id, sub(`${id.slice(0, 8)}-accm@example.test`)); }
await x(`delete from private.accm_confirm_sends`);
await age(Q.p3, 8); await age(Q.p4, 8);   // both stale: > 7 days, never had a token
check((await rawCount(Q.p3)) === 1 && (await rawCount(Q.p4)) === 1, 'R3 setup: two stale raw ACCM emails present before issue');
const r3own = await issueJ(Q.p3);         // issue for a stale request purges it first, so nothing is issued or returned
check(JSON.stringify(r3own) === '{"error":"none"}' && (await rawCount(Q.p3)) === 0, 'R3 issue for a stale request: purged first -> {"error":"none"}, no address returned', JSON.stringify(r3own));
check((await rawCount(Q.p4)) === 0, 'R3 the same issue call purges other stale requests too');
check((await sval(`select count(*)::int from private.accm_confirm_sends`)) === 0, 'R3 no send counted for the purged requests');
check((await sval(`select count(*)::int from private.access_request_accm s join public.access_requests r on r.id=s.request_id where r.user_id in ('${Q.p3}','${Q.p4}') and s.token_hash is not null`)) === 0, 'R3 no token created for the purged requests');
await expectVal('R3 purged by issue -> pending, hash kept', 'authenticated', Q.p3, `select (public.my_join_state()->'request'->>'status') || ':' || (public.my_join_state()->'request'->>'has_accm_email')`, 'pending:true');
const r3live = await issueJ(Q.p1);        // a fresh awaiting request (re-entered above) still gets its link from the same path
check(typeof r3live?.token === 'string' && r3live.token.length === 64 && (await rawCount(Q.p1)) === 1, 'R3 issue still works for a fresh request after purging others');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
