// PGlite (in-process Postgres) checks for 20261115120000_explorer_linked_tiers.sql (Sprint 3, Explorer vs Linked),
// applied on top of the migrations that are live in prod (through 20261111130000_accm_confirm_mailer.sql) plus the
// real course seed + content. Local only; never points at a Supabase project. Fake emails only (example.test); only
// labels and counts are printed, never emails or hashes.
// Covers: tier gating at the DB (RLS + RPCs), the add-only idempotent upsert, the unchanged monthly import + its
// wrapper, the audit log, verify BEFORE / AFTER / after-revert row sets, revert, and re-apply.
// Run: node scripts/qa/pglite-explorer-linked-tiers.mjs   (needs @electric-sql/pglite, e.g. npm i --no-save)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
import { createHash } from 'node:crypto';
const R = new URL('../../supabase/', import.meta.url).pathname;
const db = new PGlite({ extensions: { pgcrypto } });
process.on('unhandledRejection', (e) => { console.log('FAIL unexpected error:', e?.message); process.exit(1); });
let pass = 0, fail = 0;
const x = (s) => db.exec(s);
const as = async (role, uid, s) => { await x(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role ${role}`); try { return (await db.query(s)).rows; } finally { await x('reset role'); } };
const check = (ok, label, extra = '') => { if (ok) pass++; else fail++; console.log(ok ? 'PASS' : 'FAIL', label, ok ? '' : extra); };
const val = async (role, uid, s) => Object.values((await as(role, uid, s))[0] ?? {})[0];
const sval = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const expectVal = async (label, role, uid, s, want) => { try { const v = await val(role, uid, s); check(JSON.stringify(v) === JSON.stringify(want), label, JSON.stringify(v)); } catch (e) { check(false, label, e.message); } };
const expectErr = async (label, role, uid, s, re) => { try { await as(role, uid, s); check(false, label, 'no error'); } catch (e) { check(re.test(e.message), label, e.message); } };
const expectSub = (label, got, want) => { const bad = Object.entries(want).filter(([k, v]) => got?.[k] !== v); check(bad.length === 0, label, JSON.stringify({ got, want })); };

await x(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions; create schema storage;
create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz);
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
                 '20261102140100_seed_gold_reset.sql', '20261102170000_course_content.sql',
                 '20261102200000_member_code_atomic_reserve.sql', '20261102210000_member_code_tables_rls.sql', '20261102230000_drop_old_member_code_record.sql',
                 '20261111000000_academy_login_membership.sql', '20261111120000_access_requests.sql', '20261111130000_accm_confirm_mailer.sql'])
  await x(fs.readFileSync(R + 'migrations/' + f, 'utf8'));
// Prod facts (read-only SELECT, 15 Nov 2026): all three courses open; Strategy Basics + Advanced Setups price 2000, sales closed.
await x(`update public.training_courses set status = 'open' where slug in ('gold-reset','gold-strategy-basics','gold-advanced-setups')`);

const VERIFY = fs.readFileSync(R + 'verification/20261115120000_explorer_linked_tiers_verify.sql', 'utf8');
const verifyRows = async () => (await db.query(VERIFY)).rows;
const PRE = ['pre: Gold Reset course row', 'pre: paid courses gold-strategy-basics', 'monthly import_allowlist body unchanged',
             'private schema: anon/authenticated have no USAGE', 'unchanged: has_course_access + my_payment_info', 'revert: match_access_requests body is',
             'revert: has_course_access body is', 'revert: my_payment_info body is', 'revert: submit_access_request body is'];
// md5 of a function body as written in a migration file (the text between `as $$` and `$$;`), for byte-for-byte checks.
const fileBodyMd5 = (file, name) => { const t = fs.readFileSync(file, 'utf8'); const i = t.indexOf(`create or replace function ${name}`); const j = t.indexOf('$$', i) + 2;
  return createHash('md5').update(t.slice(j, t.indexOf('$$;', j))).digest('hex'); };
const fnMd5 = (name) => sval(`select md5(prosrc) from pg_proc where oid = to_regprocedure('${name}')`);
const MAR_LIVE = fileBodyMd5(R + 'migrations/20261111130000_accm_confirm_mailer.sql', 'private.match_access_requests');
check(MAR_LIVE === '252ce0b1289b29c27ef329532e95c9cf', 'live match_access_requests body in the repo = prod md5 (read-only SELECT, 15 Nov)', MAR_LIVE);
check((await fnMd5('private.match_access_requests()')) === MAR_LIVE, 'before: installed match_access_requests = live body');
const label = (c) => PRE.find((p) => c.startsWith(p));
{
  const v = await verifyRows();
  const t = v.filter((r) => r.ok).map((r) => label(r.check) ?? r.check);
  check(v.length === 19 && JSON.stringify(t) === JSON.stringify(PRE), `verify BEFORE: exactly the ${PRE.length} documented rows are true (incl. prod md5s = repo bodies)`, JSON.stringify(v.filter((r) => r.ok !== PRE.includes(label(r.check) ?? '')).map((r) => r.check)));
}

// ---- fixtures (fake) ----
const U = {
  expC: '10000000-0000-0000-0000-000000000001',  // Explorer, confirmed, join-v2 consented
  expN: '10000000-0000-0000-0000-000000000002',  // Explorer, confirmed, never consented
  unconf: '10000000-0000-0000-0000-000000000003', // unconfirmed email
  link: '10000000-0000-0000-0000-000000000004',  // Linked (listed + consented), bought both paid courses
  linkNoBuy: '10000000-0000-0000-0000-000000000005', // Linked, bought nothing
  req: '10000000-0000-0000-0000-000000000006',   // consented, same-email pending request
  aw: '10000000-0000-0000-0000-000000000007',    // consented, different-email request awaiting confirmation
  cx: '10000000-0000-0000-0000-000000000008',    // claims Y's email as a CONFIRMED ACCM email (owner conflict)
  cy: '10000000-0000-0000-0000-000000000009',    // consented Explorer whose Academy email is also cx's ACCM email
  rv: '10000000-0000-0000-0000-00000000000a',    // consented Explorer used only for the request consent-version checks
};
const E = Object.fromEntries(Object.keys(U).map((k) => [k, `${k.toLowerCase()}@example.test`]));
await x(`insert into auth.users values ${Object.keys(U).map((k) => `('${U[k]}','${E[k]}',${k === 'unconf' ? 'null' : 'now()'})`).join(',')}`);
await x(`select private.import_allowlist('[{"email":"${E.link}","role":"client"},{"email":"${E.linkNoBuy}","role":"client"}]')`);
const consent = `select public.record_member_consent('join-v2')`;
for (const k of ['expC', 'link', 'linkNoBuy', 'req', 'aw', 'cx', 'cy', 'rv']) await as('authenticated', U[k], consent);
await expectVal('fixture: Linked is active', 'authenticated', U.link, 'select public.my_membership()', 'active');
await expectVal('fixture: consented Explorer is none', 'authenticated', U.expC, 'select public.my_membership()', 'none');
await x(`insert into public.course_purchases (user_id, course_id, price_php, amount_entered, payment_code, gcash_ref, receipt_sha256, status, decided_at)
  select '${U.link}', id, price_php, price_php, 'GFX-TEST', '123456789012' || sort, repeat(sort::text, 64), 'approved', now()
    from public.training_courses where slug in ('gold-strategy-basics','gold-advanced-setups')`);
await as('authenticated', U.req, `select public.submit_access_request(null, null, 'request-v1', '203.0.113.9')`);
await x(`insert into public.access_requests (user_id, academy_email_hash, accm_email_hash, consent_version, status)
  values ('${U.aw}', private.email_hash('${E.aw}'), private.email_hash('other-aw@example.test'), 'request-v1', 'awaiting_email_confirm')`);
await x(`insert into public.access_requests (user_id, academy_email_hash, accm_email_hash, accm_email_confirmed_at, consent_version, status)
  values ('${U.cx}', private.email_hash('${E.cx}'), private.email_hash('${E.cy}'), now(), 'request-v1', 'pending')`);

const lessonsOf = (slug) => `select count(*)::int from public.training_lessons l join public.training_modules m on m.id = l.module_id
  join public.training_courses c on c.id = m.course_id where c.slug = '${slug}'`;
const firstLesson = (slug) => `(select l.id from public.training_lessons l join public.training_modules m on m.id = l.module_id
  join public.training_courses c on c.id = m.course_id where c.slug = '${slug}' and l.status = 'published' order by m.sort, l.sort limit 1)`;
const COURSES = ['gold-reset', 'gold-strategy-basics', 'gold-advanced-setups'];
const published = {};
for (const c of COURSES) published[c] = await sval(lessonsOf(c) + ` and l.status = 'published'`);
check(COURSES.every((c) => published[c] > 0), 'fixture: all three courses have published lessons', JSON.stringify(published));

const gating = async (phase, rules) => {
  for (const [who, want] of rules) {
    for (const c of COURSES) {
      const n = await val(who === 'anon' ? 'anon' : 'authenticated', who === 'anon' ? '' : U[who], lessonsOf(c)).catch(() => 0);
      const open = want.includes(c);
      check(open ? n === published[c] : n === 0, `${phase}: ${who} ${open ? 'CAN' : 'cannot'} read ${c} lessons (RLS)`, `n=${n}`);
    }
  }
};
// ---- BEFORE the migration: Explorers cannot read Gold Reset (today's rule) ----
await gating('before', [['expC', []], ['link', COURSES]]);

await expectErr('before: live submit_access_request refuses request-v2 (apply the migration before the app deploys)', 'authenticated', U.rv,
  `select public.submit_access_request(null, null, 'request-v2', '203.0.113.20')`, /unknown consent version/);
const MIG = fs.readFileSync(R + 'migrations/20261115120000_explorer_linked_tiers.sql', 'utf8');
try { await x(MIG); await x(MIG); check(true, 'migration applies twice (idempotent)'); } catch (e) { check(false, 'migration applies twice', e.message); process.exit(1); }
{
  const v = await verifyRows();
  const bad = v.filter((r) => r.ok !== !r.check.startsWith('revert:')).map((r) => r.check);
  check(v.length === 19 && bad.length === 0 && v.filter((r) => r.ok).length === 15, 'verify AFTER: all 15 non-revert rows true, the 4 revert rows false', JSON.stringify(bad));
}
// ---- request consent version (Privacy v1.6): new consents store 'request-v2'; 'request-v1' stays accepted ----
{
  const sub = (v) => `select public.submit_access_request(null, null, ${v === null ? 'null' : `'${v}'`}, '203.0.113.20')`;
  const app = fs.readFileSync(R + '../src/content/access-request.ts', 'utf8').match(/REQUEST_CONSENT_VERSION = "([^"]+)"/)[1];
  check(app === 'request-v2', 'app sends request-v2', app);
  await expectVal('after: request-v2 accepted', 'authenticated', U.rv, sub('request-v2'), 'pending');
  const stored = (await db.query(`select consent_version from public.access_requests where user_id = '${U.rv}'`)).rows[0]?.consent_version;
  check(stored === 'request-v2', 'after: new request stores consent_version request-v2', stored);
  await expectVal('after: request-v1 still accepted (page loaded before a deploy)', 'authenticated', U.rv, sub('request-v1'), 'pending');
  await expectErr('after: unknown version refused', 'authenticated', U.rv, sub('request-v3'), /unknown consent version/);
  await expectErr('after: null version refused', 'authenticated', U.rv, sub(null), /unknown consent version/);
  const v1rows = (await db.query(`select count(*)::int as n from public.access_requests where consent_version = 'request-v1' and status in ('pending', 'awaiting_email_confirm')`)).rows[0].n;
  check(v1rows >= 2, 'existing request-v1 rows untouched (no re-consent)', String(v1rows));
  await x(`delete from public.access_requests where user_id = '${U.rv}'`); // keep the import counts below independent of this block
}

// ---- tier gating (spec §1, §2.4, acceptance 1, 8) ----
await gating('after', [
  ['expC', ['gold-reset']], ['expN', []], ['unconf', []], ['anon', []], ['link', COURSES], ['linkNoBuy', ['gold-reset']],
]);
await expectVal('Explorer (consented): my_payment_info gold-reset = free', 'authenticated', U.expC, `select public.my_payment_info('gold-reset')->>'state'`, 'free');
await expectVal('Explorer (consented): my_payment_info gold-strategy-basics = not_member (Link, never Buy)', 'authenticated', U.expC, `select public.my_payment_info('gold-strategy-basics')->>'state'`, 'not_member');
await expectVal('Explorer (consented): my_payment_info gold-advanced-setups = not_member', 'authenticated', U.expC, `select public.my_payment_info('gold-advanced-setups')->>'state'`, 'not_member');
await expectVal('Explorer (no consent): my_payment_info gold-reset = not_member (consent first)', 'authenticated', U.expN, `select public.my_payment_info('gold-reset')->>'state'`, 'not_member');
await expectVal('unconfirmed email: my_payment_info gold-reset = not_member', 'authenticated', U.unconf, `select public.my_payment_info('gold-reset')->>'state'`, 'not_member');
await expectVal('Linked: my_payment_info gold-reset = free', 'authenticated', U.link, `select public.my_payment_info('gold-reset')->>'state'`, 'free');
await expectVal('Linked (bought): gold-strategy-basics = approved', 'authenticated', U.link, `select public.my_payment_info('gold-strategy-basics')->>'state'`, 'approved');
await expectVal('Linked (bought): gold-advanced-setups = approved', 'authenticated', U.link, `select public.my_payment_info('gold-advanced-setups')->>'state'`, 'approved');
await expectVal('Linked (not bought): gold-strategy-basics = closed (existing paid path)', 'authenticated', U.linkNoBuy, `select public.my_payment_info('gold-strategy-basics')->>'state'`, 'closed');
await expectVal('Explorer (consented): Gold Reset quiz loads', 'authenticated', U.expC, `select public.get_lesson_quiz(${firstLesson('gold-reset')}) is not null`, true);
try { await as('authenticated', U.expC, `select public.set_practice_done(${firstLesson('gold-reset')}, true)`); check(true, 'Explorer (consented): Gold Reset practice can be ticked'); } catch (e) { check(false, 'Explorer (consented): Gold Reset practice can be ticked', e.message); }
await expectVal('Explorer (consented): own progress row readable', 'authenticated', U.expC, `select count(*)::int from public.training_progress`, 1);
await expectErr('Explorer (consented): Strategy Basics practice refused', 'authenticated', U.expC, `select public.set_practice_done(${firstLesson('gold-strategy-basics')}, true)`, /no access/);
await expectVal('Explorer (consented): Strategy Basics quiz hidden', 'authenticated', U.expC, `select public.get_lesson_quiz(${firstLesson('gold-strategy-basics')}) is null`, true);
await expectErr('Explorer (consented): cannot submit a purchase (not a member)', 'authenticated', U.expC,
  `select public.submit_course_purchase('gold-strategy-basics', 2000, '1234567890123', '${U.expC}/00000000-0000-0000-0000-000000000001.png', '${'b'.repeat(64)}')`, /not a member/);
await expectVal('Explorer (consented): placement quiz hidden (Linked only)', 'authenticated', U.expC, `select public.get_placement_quiz('gold-advanced-setups') is null`, true);
await expectVal('Explorer (consented): still not a member (no silent link)', 'authenticated', U.expC, 'select public.my_membership()', 'none');

// ---- upsert: privileges ----
for (const role of ['anon', 'authenticated']) {
  await expectErr(`${role} cannot run upsert_allowlist`, role, role === 'anon' ? '' : U.expC, `select private.upsert_allowlist('[]'::jsonb)`, /permission denied/);
  await expectErr(`${role} cannot run import_allowlist_full`, role, role === 'anon' ? '' : U.expC, `select private.import_allowlist_full('[]'::jsonb)`, /permission denied/);
  await expectErr(`${role} cannot read the audit log`, role, role === 'anon' ? '' : U.expC, `select count(*) from private.allowlist_refresh_log`, /permission denied/);
}
await expectErr('upsert rejects a non-array payload', 'postgres', '', `select private.upsert_allowlist('{"email":"a@example.test"}'::jsonb)`, /must be a JSON array/);

// ---- upsert: add only + idempotent ----
const snap = async () => JSON.stringify((await db.query(`select (select coalesce(jsonb_agg(jsonb_build_array(email_hash, role) order by email_hash), '[]') from private.member_allowlist) a,
  (select coalesce(jsonb_agg(jsonb_build_array(user_id, allowlist_status, role, grace_until) order by user_id), '[]') from public.member_status) m,
  (select coalesce(jsonb_agg(jsonb_build_array(id, status, matched_via) order by id), '[]') from public.access_requests) r`)).rows[0]);
const up = async (rows, file = 'accm-export.csv') => (await db.query(`select private.upsert_allowlist($1::jsonb, $2) as r`, [JSON.stringify(rows), file])).rows[0].r;
const F1 = [
  { email: 'new1@example.test', role: 'client', account_id: '900001', name: 'Fake Name', balance: '123.45' }, // new
  { email: ` ${E.link.toUpperCase()} `, role: 'client' },          // already listed, same role (case/space-insensitive)
  { email: E.expC },                                                // consented Explorer, role missing -> client -> activated
  { email: E.expN, role: 'client' },                                 // never consented -> listed but not linked
  { email: E.req, role: 'client' },                                  // same-email pending request -> matched
  { email: 'other-aw@example.test', role: 'client' },                // unconfirmed ACCM email -> must NOT match
  { email: 'dup@example.test', role: 'client' }, { email: 'dup@example.test', role: 'ib' }, // conflicting roles
  { email: E.cy, role: 'client' },                                   // belongs to cy AND (confirmed ACCM) cx -> conflict
  { role: 'client', account_id: '900002' },                          // no email -> skipped
  { email: 'vip@example.test', role: 'vip' },                        // unknown role -> skipped
  { email: 'new1@example.test', role: 'client' },                    // duplicate row of the same email, same role
];
const before1 = await sval(`select count(*)::int from private.member_allowlist`);
const r1 = await up(F1, '/home/someone/Downloads/ACCM export\n15 Nov.csv');
expectSub('upsert #1 counts', r1, { added: 5, updated: 0, unchanged: 1, conflicts: 2, skipped: 2, consented_activated: 1, requests_matched: 1, requests_pending: 2, relisted: 0 });
check(!JSON.stringify(r1).includes('@') && !/[0-9a-f]{64}/.test(JSON.stringify(r1)), 'upsert result has no emails or hashes');
check((await sval(`select count(*)::int from private.member_allowlist`)) === before1 + 5, 'upsert #1 only added rows (+5), deleted none');
await expectVal('upsert #1: consented Explorer flipped to Linked (no extra click)', 'authenticated', U.expC, 'select public.my_membership()', 'active');
await expectVal('upsert #1: never-consented Explorer NOT silently linked', 'authenticated', U.expN, 'select public.my_membership()', 'none');
await expectVal('upsert #1: same-email pending request matched -> Linked', 'authenticated', U.req, 'select public.my_membership()', 'active');
check((await sval(`select status from public.access_requests where user_id = '${U.aw}'`)) === 'awaiting_email_confirm', 'upsert #1: unconfirmed different-email request stays awaiting (email-only, no unconfirmed match)');
await expectVal('upsert #1: unconfirmed different-email requester stays Explorer', 'authenticated', U.aw, 'select public.my_membership()', 'none');
await expectVal('upsert #1: owner-conflict email not auto-linked (cy)', 'authenticated', U.cy, 'select public.my_membership()', 'none');
await expectVal('upsert #1: owner-conflict email not auto-linked (cx)', 'authenticated', U.cx, 'select public.my_membership()', 'none');
check((await sval(`select count(*)::int from private.member_allowlist where email_hash in (private.email_hash('dup@example.test'), private.email_hash('${E.cy}'))`)) === 0, 'upsert #1: conflict emails were not added');
await gating('after upsert #1', [['expC', COURSES.slice(0, 1)]]);
await expectVal('upsert #1: flipped Explorer (no purchase) sees Strategy Basics as closed (Linked paid path)', 'authenticated', U.expC, `select public.my_payment_info('gold-strategy-basics')->>'state'`, 'closed');
{
  const log = (await db.query(`select mode, source_file, actor, added, updated, unchanged, removed, consented_activated, conflicts, skipped, requests_matched from private.allowlist_refresh_log order by id desc limit 1`)).rows[0];
  expectSub('audit row #1: mode/source_file (filename only, no path or newline)/actor/counts', log,
    { mode: 'upsert', source_file: 'ACCM export15 Nov.csv', actor: 'sql-editor', added: 5, updated: 0, unchanged: 1, removed: 0, consented_activated: 1, conflicts: 2, skipped: 2, requests_matched: 1 });
}
const s1 = await snap();
const logN = await sval(`select count(*)::int from private.allowlist_refresh_log`);
const r1b = await up(F1);
expectSub('upsert #1 re-run (same file): nothing new', r1b, { added: 0, updated: 0, unchanged: 6, conflicts: 2, skipped: 2, consented_activated: 0, requests_matched: 0, relisted: 0 });
check((await snap()) === s1, 're-run: allowlist, member_status and requests are byte-identical (idempotent)');
check((await sval(`select count(*)::int from private.allowlist_refresh_log`)) === logN + 1, 're-run: one more audit row (counts only)');
// Partial / mid-cycle file: missing people are left alone (no delete, no grace).
const r2 = await up([{ email: 'new2@example.test', role: 'ib' }]);
expectSub('upsert #2 (partial file of 1): only adds', r2, { added: 1, updated: 0, unchanged: 0, consented_activated: 0 });
check((await sval(`select count(*)::int from public.member_status where allowlist_status <> 'active'`)) === 0, 'upsert #2: nobody graced or removed');
check((await sval(`select count(*)::int from private.member_allowlist`)) === before1 + 6, 'upsert #2: nobody deleted');
await expectVal('upsert #2: Linked member missing from the partial file is still Linked', 'authenticated', U.link, 'select public.my_membership()', 'active');
// P3-2 (amendment v1.2 (5)): the upsert never changes an existing row's role, explicit or blank. New rows take the
// row's role, or client when blank. Rows with no role are not skipped. new2 is an existing 'ib' row (upsert #2).
const roleOf = (e) => sval(`select role from private.member_allowlist where email_hash = private.email_hash('${e}')`);
check((await roleOf('new2@example.test')) === 'ib', 'role fixture: new2 is an existing ib row');
const r3 = await up([{ email: 'new2@example.test', role: 'client' }]);
expectSub('upsert: existing ib + explicit client -> unchanged, nothing updated', r3, { added: 0, updated: 0, unchanged: 1, skipped: 0 });
check((await roleOf('new2@example.test')) === 'ib', 'upsert: existing ib with explicit client stays ib');
const r3b = await up([{ email: 'new2@example.test' }, { email: 'new2@example.test', role: '' }]);
expectSub('upsert: existing ib + blank role -> unchanged, not skipped', r3b, { added: 0, updated: 0, unchanged: 1, skipped: 0, conflicts: 0 });
check((await roleOf('new2@example.test')) === 'ib', 'upsert: existing ib with a blank role stays ib');
const r3c = await up([{ email: 'new4@example.test', role: 'IB' }, { email: 'new3@example.test' }, { email: 'new1@example.test', role: 'ib' }]);
expectSub('upsert: two new rows added (explicit ib, blank), existing client row unchanged', r3c, { added: 2, updated: 0, unchanged: 1, skipped: 0 });
check((await roleOf('new4@example.test')) === 'ib', 'upsert: new row with explicit ib becomes ib');
check((await roleOf('new3@example.test')) === 'client', 'upsert: new row with a blank role becomes client');
check((await roleOf('new1@example.test')) === 'client', 'upsert: existing client with explicit ib stays client');

// ---- monthly snapshot stays the only downgrade; upsert restores ----
const fullRows = [E.linkNoBuy, E.expC, E.req, 'new1@example.test', 'new2@example.test'].map((email) => ({ email, role: 'client' }));
const rf = (await db.query(`select private.import_allowlist_full($1::jsonb, 'monthly-snapshot.csv') as r`, [JSON.stringify(fullRows)])).rows[0].r;
check((await roleOf('new2@example.test')) === 'client', 'monthly snapshot can still change a role (new2 ib -> client)');
check(rf.removed > 0 && rf.consented_activated === 0, 'import_allowlist_full: monthly rules ran (removed > 0), activation ran', JSON.stringify(rf));
await expectVal('monthly snapshot without Linked member -> grace (14-day rule unchanged)', 'authenticated', U.link, 'select public.my_membership()', 'grace');
check((await sval(`select (grace_until > now() + interval '13 days' and grace_until <= now() + interval '14 days') from public.member_status where user_id = '${U.link}'`)) === true, 'grace_until is 14 days out');
await gating('in grace', [['link', COURSES]]);
{
  const log = (await db.query(`select mode, source_file, consented_activated, removed > 0 as removed from private.allowlist_refresh_log order by id desc limit 1`)).rows[0];
  expectSub('audit row (full wrapper): mode full + filename', log, { mode: 'full', source_file: 'monthly-snapshot.csv', removed: true });
}
const r4 = await up([{ email: E.link, role: 'client' }], 'mid-cycle.csv');
expectSub('upsert relists a graced member that is in the file', r4, { added: 1, relisted: 1 });
await expectVal('relisted member is Linked again (no payment step)', 'authenticated', U.link, 'select public.my_membership()', 'active');
// Plain monthly import (unchanged function) still writes its log row; mode defaults to 'full'.
await x(`select private.import_allowlist('${JSON.stringify(fullRows.concat([{ email: E.link, role: 'client' }]))}')`);
check((await sval(`select mode from private.allowlist_refresh_log order by id desc limit 1`)) === 'full', 'plain import_allowlist still logs (mode defaults to full)');
check((await sval(`select count(*)::int from private.allowlist_refresh_log where source_file ~ '[/\\\\]' or coalesce(source_file,'') ~ '@'`)) === 0, 'audit log: no paths or emails in source_file');

// ---- P3-1 / amendment v1.2 (4) + option A: a two-owner hash never links anyone, in EVERY import path ----
// qy's Academy email is also qx's CONFIRMED ACCM email (pending request) -> two owners. sN: normal single-owner
// pending requests with a confirmed ACCM email; each must still link through one of the three paths.
const Q = { qx: '10000000-0000-0000-0000-00000000000b', qy: '10000000-0000-0000-0000-00000000000c',
            s1: '10000000-0000-0000-0000-00000000000d', s2: '10000000-0000-0000-0000-00000000000e', s3: '10000000-0000-0000-0000-00000000000f' };
await x(`insert into auth.users values ${Object.keys(Q).map((k) => `('${Q[k]}','${k}@example.test',now())`).join(',')}`);
for (const k of Object.keys(Q)) await as('authenticated', Q[k], consent);
const reqRow = (k, accm) => `('${Q[k]}', private.email_hash('${k}@example.test'), private.email_hash('${accm}'), now(), 'request-v1', 'pending')`;
await x(`insert into public.access_requests (user_id, academy_email_hash, accm_email_hash, accm_email_confirmed_at, consent_version, status)
  values ${reqRow('qx', 'qy@example.test')}, ${reqRow('s1', 's1-accm@example.test')}, ${reqRow('s2', 's2-accm@example.test')}, ${reqRow('s3', 's3-accm@example.test')}`);
const reqStatus = (k) => sval(`select status from public.access_requests where user_id = '${Q[k]}'`);
const JOIN_KEYS = '["accm_confirmed","created_at","has_accm_email","ib_name","last_checked_at","status","updated_at"]';
const stillPending = async (path) => {
  check((await reqStatus('qx')) === 'pending', `${path}: two-owner request stays pending`);
  await expectVal(`${path}: ACCM-email owner (qx) NOT linked`, 'authenticated', Q.qx, 'select public.my_membership()', 'none');
  await expectVal(`${path}: Academy-email owner (qy) NOT linked`, 'authenticated', Q.qy, 'select public.my_membership()', 'none');
  const js = await val('authenticated', Q.qx, 'select public.my_join_state()');
  check(js?.request?.status === 'pending' && JSON.stringify(Object.keys(js.request).sort()) === JOIN_KEYS && !/conflict|owner/i.test(JSON.stringify(js)),
    `${path}: qx's own join state is a plain pending request (nothing reveals the conflict)`, JSON.stringify(js && Object.keys(js.request ?? {})));
};
// Path 1: import_allowlist_full (the monthly file lists the two-owner hash).
const monthly2 = fullRows.concat([{ email: E.link, role: 'client' }, { email: 'qy@example.test', role: 'client' }, { email: 's1-accm@example.test', role: 'client' }]);
const rq = (await db.query(`select private.import_allowlist_full($1::jsonb, 'monthly-2.csv') as r`, [JSON.stringify(monthly2)])).rows[0].r;
check((await sval(`select count(*)::int from private.member_allowlist where email_hash = private.email_hash('qy@example.test')`)) === 1, 'P3-1 fixture: two-owner hash is on the allowlist from the monthly file');
expectSub('full path: two-owner hash skipped (activation + request match), counted once in conflicts', rq, { consented_activated: 0, conflicts: 1, requests_matched: 1 });
check((await sval(`select conflicts from private.allowlist_refresh_log order by id desc limit 1`)) === 1, 'full path: audit row conflicts = 1');
await stillPending('full path');
check((await reqStatus('s1')) === 'matched', 'full path: single-owner pending request (s1) still links');
await expectVal('full path: s1 Linked', 'authenticated', Q.s1, 'select public.my_membership()', 'active');
// Path 2: upsert (two-owner hash already listed; this file adds s2's ACCM email).
const rqu = await up([{ email: 'unrelated@example.test', role: 'client' }, { email: 's2-accm@example.test' }], 'mid-cycle-2.csv');
expectSub('upsert path: two-owner hash skipped, counted in conflicts', rqu, { added: 2, consented_activated: 0, conflicts: 1, requests_matched: 1 });
check((await sval(`select conflicts from private.allowlist_refresh_log order by id desc limit 1`)) === 1, 'upsert path: audit row conflicts = 1');
await stillPending('upsert path');
check((await reqStatus('s2')) === 'matched', 'upsert path: single-owner pending request (s2) still links');
await expectVal('upsert path: s2 Linked', 'authenticated', Q.s2, 'select public.my_membership()', 'active');
// Path 3: the live import_allowlist, called directly (body unchanged; it calls match_access_requests).
const monthly3 = monthly2.concat([{ email: 's2-accm@example.test', role: 'client' }, { email: 's3-accm@example.test', role: 'client' }]);
const rqp = (await db.query(`select private.import_allowlist($1::jsonb) as r`, [JSON.stringify(monthly3)])).rows[0].r;
expectSub('plain import_allowlist path: two-owner request skipped, counted in its result', rqp, { conflicts: 1, requests_matched: 1 });
await stillPending('plain import_allowlist path');
check((await reqStatus('s3')) === 'matched', 'plain import_allowlist path: single-owner pending request (s3) still links');
await expectVal('plain import_allowlist path: s3 Linked', 'authenticated', Q.s3, 'select public.my_membership()', 'active');
check(!/@|[0-9a-f]{64}/.test(JSON.stringify([rq, rqu, rqp])), 'conflict results carry counts only (no emails or hashes)');
// Re-running keeps it pending and idempotent (conflict counted again, nothing linked).
const rqu2 = await up([{ email: 'unrelated@example.test', role: 'client' }], 'mid-cycle-3.csv');
expectSub('upsert re-run: still 1 conflict, nothing linked', rqu2, { consented_activated: 0, conflicts: 1, requests_matched: 0 });
await stillPending('upsert re-run');
// Conflicts count only skips that actually happened: d1's pending request names d2's email (two owners) as its ACCM
// email, but d1 still matches through its own single-owner Academy email -> linked, and no extra conflict counted.
// d2 never consented (not an activation candidate). The only conflict left is the qx/qy one.
const D = { d1: '10000000-0000-0000-0000-000000000010', d2: '10000000-0000-0000-0000-000000000011' };
await x(`insert into auth.users values ('${D.d1}','d1@example.test',now()),('${D.d2}','d2@example.test',now())`);
await as('authenticated', D.d1, consent);
await x(`insert into public.access_requests (user_id, academy_email_hash, accm_email_hash, accm_email_confirmed_at, consent_version, status)
  values ('${D.d1}', private.email_hash('d1@example.test'), private.email_hash('d2@example.test'), now(), 'request-v1', 'pending')`);
await x(`insert into private.member_allowlist (email_hash, role) values (private.email_hash('d2@example.test'), 'client')`); // as if from the monthly file
const rd = await up([{ email: 'd1@example.test' }], 'mid-cycle-4.csv');
expectSub('real skips only: d1 links via its own email, conflicts stays 1 (qx/qy only)', rd, { added: 1, conflicts: 1, requests_matched: 1 });
check((await sval(`select status || '/' || matched_via from public.access_requests where user_id = '${D.d1}'`)) === 'matched/academy', 'real skips only: d1 matched via academy (the two-owner ACCM email was not used)');
check((await sval(`select conflicts from private.allowlist_refresh_log order by id desc limit 1`)) === 1, 'real skips only: audit row conflicts = 1');
await stillPending('after the d1 upsert');
// Direct call (QA repro S4): match_access_requests() on its own also keeps the two-owner request pending.
const rm = (await db.query(`select private.match_access_requests() as r`)).rows[0].r;
expectSub('direct match_access_requests() call: conflict counted, nothing matched', rm, { conflicts: 1, requests_matched: 0 });
await stillPending('direct match_access_requests() call');

// ---- revert + re-apply ----
const REV = fs.readFileSync(R + 'scripts/20261115_explorer_linked_tiers/revert.sql', 'utf8');
try { await x(REV); await x(REV); check(true, 'revert applies twice (idempotent)'); } catch (e) { check(false, 'revert applies twice', e.message); }
{
  const v = await verifyRows();
  const bad = v.filter((r) => r.ok !== (label(r.check) !== undefined)).map((r) => r.check);
  check(bad.length === 0, 'verify AFTER REVERT: only the documented pre/unchanged/revert rows are true', JSON.stringify(bad));
}
check((await fnMd5('private.match_access_requests()')) === MAR_LIVE, 'after revert: match_access_requests md5 = the original live body (byte for byte)');
check((await sval(`select has_function_privilege('anon', 'private.match_access_requests()', 'execute') or has_function_privilege('authenticated', 'private.match_access_requests()', 'execute')`)) === false,
  'after revert: match_access_requests grants unchanged (no anon/authenticated EXECUTE)');
check((await sval(`select to_regprocedure('private.hash_owners()') is null`)) === true, 'after revert: hash_owners dropped');
{ // Old behaviour back: the live body matches the two-owner pending request again.
  const r = (await db.query(`select private.import_allowlist($1::jsonb) as r`, [JSON.stringify(monthly3)])).rows[0].r;
  check(r.conflicts === undefined && r.requests_matched === 1 && (await reqStatus('qx')) === 'matched', 'after revert: old behaviour back (two-owner request matches, no conflicts key)', JSON.stringify(r));
}
await expectErr('after revert: request-v2 refused again (live 15 Nov body)', 'authenticated', U.rv,
  `select public.submit_access_request(null, null, 'request-v2', '203.0.113.20')`, /unknown consent version/);
await x(`delete from public.member_status where user_id = '${U.expC}'`); // back to a plain consented Explorer
await gating('after revert', [['expC', []]]);
try { await x(MIG); check(true, 're-apply after revert'); } catch (e) { check(false, 're-apply after revert', e.message); }
await gating('after re-apply', [['expC', ['gold-reset']]]);
{ const v = await verifyRows(); check(v.filter((r) => !r.ok).every((r) => r.check.startsWith('revert:')), 'verify after re-apply: all non-revert rows true'); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
