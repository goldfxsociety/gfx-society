// Local, offline test of the lesson-risk-dedupe SQL on an in-memory PGlite (never a hosted DB).
// Seeds the 13 original rows from the literals embedded in 03_revert.sql, plus decoys, then runs the scripts.
// Run: npm i --no-save --prefix /tmp/pgl @electric-sql/pglite && PGLITE=/tmp/pgl/node_modules/@electric-sql/pglite/dist/index.js node supabase/scripts/20261115_lesson_risk_dedupe/local-test.mjs
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const { PGlite } = await import(process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : "@electric-sql/pglite");
const F = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const APPLY = F("02_apply.sql"), REVERT = F("03_revert.sql"), VERIFY = F("verify.sql"), BACKUP = F("01_backup.sql");

const manifest = JSON.parse(APPLY.match(/\$m\$([\s\S]*?)\$m\$/)[1]);
const lit = [...REVERT.matchAll(/\('([0-9a-f-]{36})'::uuid,\n {7}\$lrd_orig_20261115\$([\s\S]*?)\$lrd_orig_20261115\$,\n {7}\$lrd_orig_20261115\$([\s\S]*?)\$lrd_orig_20261115\$::jsonb,\n {7}'([^']+)'::timestamptz\)/g)]
  .map(([, id, content, tk, ts]) => ({ id, content, tk, ts }));
assert.equal(manifest.length, 13); assert.equal(lit.length, 13, "13 embedded originals");

let n = 0; const ok = (name) => console.log(`PASS ${++n} ${name}`);
const db = new PGlite();
await db.exec(`
  create table public.levels (id uuid primary key, slug text not null unique);
  create table public.lessons (id uuid primary key default gen_random_uuid(), level_id uuid not null references public.levels(id), slug text not null,
    title text not null default 't', content text not null, key_takeaways jsonb not null default '[]'::jsonb, is_published boolean not null default true,
    updated_at timestamptz not null default now(), unique (level_id, slug));`);
for (const lv of new Set(manifest.map((m) => m.level_id))) await db.query("insert into public.levels values ($1, $2)", [lv, `lv-${lv.slice(0, 4)}`]);
await db.query("insert into public.levels values ('00000000-0000-4000-8000-000000000001', 'decoy-level')");
for (const o of lit) {
  const m = manifest.find((x) => x.id === o.id);
  await db.query("insert into public.lessons (id, level_id, slug, content, key_takeaways, updated_at) values ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)", [o.id, m.level_id, m.slug, o.content, o.tk, o.ts]);
}
// Decoy 1: same slug as a target, another level, identical original text. Decoy 2: an unrelated lesson teaching the 1% rule.
const spread = lit.find((o) => o.id === manifest.find((m) => m.slug === "what-is-a-spread").id);
await db.query("insert into public.lessons (id, level_id, slug, content, key_takeaways, updated_at) values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001', 'what-is-a-spread', $1, $2::jsonb, '2026-01-01 00:00:00+00')", [spread.content, spread.tk]);
await db.query("insert into public.lessons (id, level_id, slug, content, updated_at) values ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-000000000001', 'position-sizing', 'Max 1% risk per trade. Education only, not financial advice.', '2026-01-01 00:00:00+00')");

const snap = async () => (await db.query("select id::text, slug, content, key_takeaways::text as tk, updated_at::text as ts from public.lessons order by id")).rows;
const verify = async () => (await db.query(VERIFY)).rows;
const run = async (sql) => { const notices = []; try { await db.exec(sql, { onNotice: (x) => notices.push(x.message) }); return { notices }; } catch (e) { await db.exec("rollback"); return { error: e.message, notices }; } };
const seed = await snap();

let v = await verify();
assert.ok(v.length === 13 && v.every((r) => r.state === "BEFORE" && r.level_slug_ok && r.updated_at_is_original)); ok("verify before: 13 BEFORE, level+slug ok");
const b = (await db.query(BACKUP)).rows[0];
assert.equal(b.rows, 13); assert.equal(b.all_level_slug_ok, true); assert.equal(b.all_before, true);
const bj = JSON.parse(b.lessons_backup_json);
assert.equal(bj.length, 13); assert.ok(bj.every((r) => r.content === lit.find((o) => o.id === r.id).content && "updated_at" in r && "level_id" in r && "key_takeaways" in r));
ok("01_backup: read-only export, 13 rows, every edited column + updated_at, matches originals");

let r = await run(APPLY);
assert.equal(r.error, undefined, r.error); assert.ok(r.notices.some((x) => /13 rows updated and verified/.test(x)));
v = await verify();
assert.ok(v.every((x) => x.state === "AFTER" && x.body_max_n === 0 && x.body_nfa_n === 0 && !x.updated_at_is_original), JSON.stringify(v));
ok("apply: exactly 13 rows -> AFTER (pinned md5), once-rule body counts 0/0, updated_at bumped");
const opening = (await db.query("select content from public.lessons where slug = 'opening-your-accm-account'")).rows[0].content;
assert.ok(opening.includes("Risk no more than 1% of your account on each trade, with a stop-loss on every trade.") && !opening.includes("Max 1% risk per trade") && opening.includes("Disclosure: ACCM is GFX's partner broker.") && !/financial advice/i.test(opening));
ok("D: Design wording in, 'Max 1% risk per trade' and the NFA gone, IB disclosure kept");
const afterApply = await snap();
const decoys = (s) => s.filter((x) => x.id.startsWith("00000000"));
assert.deepEqual(decoys(afterApply), decoys(seed)); ok("same slug in another level + unrelated 1% lesson untouched");

r = await run(APPLY);
assert.equal(r.error, undefined); assert.ok(r.notices.some((x) => /already in the AFTER state\. Nothing changed/.test(x)));
assert.deepEqual(await snap(), afterApply); ok("apply rerun: NOTICE, no-op (no row or updated_at changed)");

r = await run(REVERT);
assert.equal(r.error, undefined, r.error); assert.ok(r.notices.some((x) => /13 rows restored/.test(x)));
assert.deepEqual(await snap(), seed); ok("revert: byte-for-byte originals incl. key_takeaways text and updated_at");
v = await verify(); assert.ok(v.every((x) => x.state === "BEFORE" && x.updated_at_is_original)); ok("verify after revert: 13 BEFORE, updated_at original");
r = await run(REVERT); assert.equal(r.error, undefined); assert.ok(r.notices.some((x) => /already hold the original text/.test(x))); assert.deepEqual(await snap(), seed); ok("revert rerun: NOTICE, no-op");

// Drift before apply: one character changed in one row -> abort, nothing written.
await db.exec("update public.lessons set content = replace(content, 'Trading involves real risk', 'Trading involves real  risk') where slug = 'types-of-orders' and level_id <> '00000000-0000-4000-8000-000000000001'");
let pre = await snap();
r = await run(APPLY); assert.match(r.error ?? "", /ABORTED, nothing changed: expected all 13 rows in the pinned BEFORE state, found before=12 after=0.*types-of-orders=DRIFTED/);
assert.deepEqual(await snap(), pre); ok("drift before apply: RAISE, names the row, 0 rows written");
await db.exec("rollback"); for (const o of lit) await db.query("update public.lessons set content = $2, key_takeaways = $3::jsonb, updated_at = $4::timestamptz where id = $1", [o.id, o.content, o.tk, o.ts]);
assert.deepEqual(await snap(), seed);

// Mixed: apply, then one row put back to its original by hand -> apply and revert both abort.
assert.equal((await run(APPLY)).error, undefined);
const o1 = lit[0];
await db.query("update public.lessons set content = $2, key_takeaways = $3::jsonb where id = $1", [o1.id, o1.content, o1.tk]);
pre = await snap();
r = await run(APPLY); assert.match(r.error ?? "", /found before=1 after=12 \(mixed or drifted\)/); assert.deepEqual(await snap(), pre);
r = await run(REVERT); assert.match(r.error ?? "", /ABORTED, nothing changed: expected all 13 rows in the exact AFTER state, found original=1 after=12/); assert.deepEqual(await snap(), pre);
ok("mixed state: apply and revert both RAISE, 0 rows written");

// Edited after apply: revert must not clobber it.
const m0 = manifest.find((m) => m.id === o1.id);
await db.query("update public.lessons set content = $2, key_takeaways = (select key_takeaways from public.lessons where id = $1) where id = $1", [o1.id, afterApply.find((x) => x.id === o1.id).content + "\nNew paragraph added later."]);
pre = await snap();
r = await run(REVERT); assert.match(r.error ?? "", new RegExp(`${m0.slug}=DRIFTED`)); assert.deepEqual(await snap(), pre);
ok("edited after apply: revert RAISEs (DRIFTED), later edit kept");

// Wrong level / missing row.
await db.exec("update public.lessons set level_id = '00000000-0000-4000-8000-000000000001', slug = 'stocks-moved' where slug = 'stocks-vs-forex-vs-gold'");
r = await run(APPLY); assert.match(r.error ?? "", /found 12\. States:.*stocks-vs-forex-vs-gold=WRONG_LEVEL_OR_SLUG/); ok("wrong level_id/slug for an id: RAISE");
await db.exec("delete from public.lessons where slug = 'stocks-moved'");
r = await run(REVERT); assert.match(r.error ?? "", /found 12\. States:.*=MISSING/); ok("missing id: RAISE");

// Byte-level: literal round trip equals the original md5s pinned in the manifest.
for (const o of lit) { const m = manifest.find((x) => x.id === o.id); const h = (await db.query("select md5($1::text) c, md5(($2::jsonb)::text) t", [o.content, o.tk])).rows[0]; assert.deepEqual([h.c, h.t], [m.before_content_md5, m.before_tk_md5]); }
ok("embedded literals hash to the pinned prod md5s (content + key_takeaways::text)");
console.log(`ALL PASS lesson-risk-dedupe local SQL (${n})`);
