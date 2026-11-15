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
const PRE = ['pre: Gold Reset course row', 'pre: paid courses gold-strategy-basics', 'monthly import_allowlist body unchanged', 'match_access_requests body unchanged',
             'private schema: anon/authenticated have no USAGE', 'unchanged: has_course_access + my_payment_info', 'revert: has_course_access body is', 'revert: my_payment_info body is',
             'revert: submit_access_request body is'];
const label = (c) => PRE.find((p) => c.startsWith(p));
{
  const v = await verifyRows();
  const t = v.filter((r) => r.ok).map((r) => label(r.check) ?? r.check);
  check(v.length === 18 && JSON.stringify(t) === JSON.stringify(PRE), `verify BEFORE: exactly the ${PRE.length} documented rows are true (incl. prod md5s = repo bodies)`, JSON.stringify(v.filter((r) => r.ok !== PRE.includes(label(r.check) ?? '')).map((r) => r.check)));
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
  check(v.length === 18 && bad.length === 0, 'verify AFTER: all 15 non-revert rows true, the 3 revert rows false', JSON.stringify(bad));
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
const r3 = await up([{ email: 'new1@example.test', role: 'IB' }]);
expectSub('upsert #3: role change counts as updated', r3, { added: 0, updated: 1, unchanged: 0 });

// ---- monthly snapshot stays the only downgrade; upsert restores ----
const fullRows = [E.linkNoBuy, E.expC, E.req, 'new1@example.test', 'new2@example.test'].map((email) => ({ email, role: 'client' }));
const rf = (await db.query(`select private.import_allowlist_full($1::jsonb, 'monthly-snapshot.csv') as r`, [JSON.stringify(fullRows)])).rows[0].r;
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

// ---- revert + re-apply ----
const REV = fs.readFileSync(R + 'scripts/20261115_explorer_linked_tiers/revert.sql', 'utf8');
try { await x(REV); await x(REV); check(true, 'revert applies twice (idempotent)'); } catch (e) { check(false, 'revert applies twice', e.message); }
{
  const v = await verifyRows();
  const bad = v.filter((r) => r.ok !== (label(r.check) !== undefined)).map((r) => r.check);
  check(bad.length === 0, 'verify AFTER REVERT: only the documented pre/unchanged/revert rows are true', JSON.stringify(bad));
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
