// Local, offline test of the accm-lesson-deposit-edit SQL on an in-memory PGlite (never a hosted DB).
// Seeds the live row from the literal embedded in 03_revert.sql (key_takeaways from the PR #74 revert file, md5-checked),
// plus decoys, then runs the scripts.
// Run: npm i --no-save --prefix /tmp/pgl @electric-sql/pglite && PGLITE=/tmp/pgl/node_modules/@electric-sql/pglite/dist/index.js node supabase/scripts/20261115_accm_lesson_deposit_edit/local-test.mjs
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const { PGlite } = await import(process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : "@electric-sql/pglite");
const F = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const APPLY = F("02_apply.sql"), REVERT = F("03_revert.sql"), VERIFY = F("verify.sql"), BACKUP = F("01_backup.sql");

const c = (name) => APPLY.match(new RegExp(`${name}\\s+constant (?:uuid|text) := '([^']+)'`))[1];
const ID = c("v_id"), LEVEL = c("v_level"), SLUG = c("v_slug"), BEFORE = c("v_before"), AFTER = c("v_after"), TK = c("v_tk");
const UPD = REVERT.match(/v_upd\s+constant timestamptz := '([^']+)'/)[1];
const ORIG = REVERT.match(/orig\s+constant text := \$alde_orig_20261115\$([\s\S]*?)\$alde_orig_20261115\$;/)[1];
const OLD = "Minimum deposit: $50 (as of Oct 2026), via GCash, Maya, or other e-wallets; check ACCM's site for current terms.";
const NEW = "Deposit details are in the app after you log in; check ACCM's site for current terms.";
// key_takeaways of this row (unchanged by PR #74 and by this edit), from the PR #74 revert literal.
const prev = fs.readFileSync(path.join(dir, "../20261115_lesson_risk_dedupe/03_revert.sql"), "utf8");
const TKV = prev.match(new RegExp(`\\('${ID}'::uuid,\\n {7}\\$lrd_orig_20261115\\$[\\s\\S]*?\\$lrd_orig_20261115\\$,\\n {7}\\$lrd_orig_20261115\\$([\\s\\S]*?)\\$lrd_orig_20261115\\$::jsonb`))[1];

let n = 0; const ok = (name) => console.log(`PASS ${++n} ${name}`);
const db = new PGlite();
await db.exec(`
  create table public.levels (id uuid primary key, slug text not null unique);
  create table public.lessons (id uuid primary key default gen_random_uuid(), level_id uuid not null references public.levels(id), slug text not null,
    title text not null default 't', content text not null, key_takeaways jsonb not null default '[]'::jsonb, is_published boolean not null default true,
    updated_at timestamptz not null default now(), unique (level_id, slug));`);
const DECOY_LV = "00000000-0000-4000-8000-000000000001";
await db.query("insert into public.levels values ($1, 'graduation'), ($2, 'decoy-level')", [LEVEL, DECOY_LV]);
await db.query("insert into public.lessons (id, level_id, slug, content, key_takeaways, updated_at) values ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)", [ID, LEVEL, SLUG, ORIG, TKV, UPD]);
// Decoy 1: same slug, another level, identical text. Decoy 2: another lesson quoting the same deposit sentence.
await db.query("insert into public.lessons (id, level_id, slug, content, key_takeaways, updated_at) values ('00000000-0000-4000-8000-0000000000d1', $1, $2, $3, $4::jsonb, '2026-01-01 00:00:00+00')", [DECOY_LV, SLUG, ORIG, TKV]);
await db.query("insert into public.lessons (id, level_id, slug, content, updated_at) values ('00000000-0000-4000-8000-0000000000d2', $1, 'funding-notes', $2, '2026-01-01 00:00:00+00')", [DECOY_LV, `Note. ${OLD}`]);

const snap = async () => (await db.query("select id::text, slug, content, key_takeaways::text as tk, updated_at::text as ts from public.lessons order by id")).rows;
const verify = async () => (await db.query(VERIFY)).rows;
const run = async (sql) => { const notices = []; try { await db.exec(sql, { onNotice: (x) => notices.push(x.message) }); return { notices }; } catch (e) { await db.exec("rollback"); return { error: e.message, notices }; } };
const seed = await snap();
const decoys = (s) => s.filter((x) => x.id.startsWith("00000000"));

const h = (await db.query("select md5($1::text) c, md5(($2::jsonb)::text) t", [ORIG, TKV])).rows[0];
assert.deepEqual([h.c, h.t], [BEFORE, TK]); ok("embedded original + seeded key_takeaways hash to the pinned prod md5s");
assert.equal(ORIG.split(OLD).length - 1, 1); ok("original has the spec's old sentence exactly once");

let v = await verify();
assert.equal(v.length, 1);
assert.deepEqual({ state: v[0].state, level_slug_ok: v[0].level_slug_ok, deposit_terms_n: v[0].deposit_terms_n, body_max_n: v[0].body_max_n, body_nfa_n: v[0].body_nfa_n, ib_line_ok: v[0].ib_line_ok, risk_step_ok: v[0].risk_step_ok, has_new_sentence: v[0].has_new_sentence, updated_at_is_original: v[0].updated_at_is_original },
  { state: "BEFORE", level_slug_ok: true, deposit_terms_n: 3, body_max_n: 0, body_nfa_n: 0, ib_line_ok: true, risk_step_ok: true, has_new_sentence: false, updated_at_is_original: true });
ok("verify before: BEFORE, level+slug ok, $50/GCash/Maya = 3, once-rule counters 0/0, IB line + 1% step present");
const b = (await db.query(BACKUP)).rows[0];
assert.equal(b.rows, 1); assert.equal(b.level_slug_ok, true); assert.equal(b.is_before, true);
const bj = JSON.parse(b.lesson_backup_json);
assert.ok(bj.length === 1 && bj[0].content === ORIG && "updated_at" in bj[0] && "key_takeaways" in bj[0] && bj[0].level_id === LEVEL);
ok("01_backup: read-only export, 1 row, content + key_takeaways + updated_at, matches the original");

let r = await run(APPLY);
assert.equal(r.error, undefined, r.error); assert.ok(r.notices.some((x) => /1 row updated and verified/.test(x)));
const afterApply = await snap();
const row = afterApply.find((x) => x.id === ID);
assert.equal(row.content, ORIG.replace(OLD, NEW)); ok("apply: exactly the one replacement, every other byte unchanged");
assert.ok(!/\$50|GCash|Maya/i.test(row.content + row.tk)); ok("acceptance: 0 matches for $50|GCash|Maya in the lesson");
assert.ok(row.content.includes("Risk no more than 1% of your account on each trade, with a stop-loss on every trade.") && row.content.includes("Disclosure: ACCM is GFX's partner broker."));
ok("1% step sentence and IB disclosure line kept");
v = await verify();
assert.ok(v[0].state === "AFTER" && v[0].deposit_terms_n === 0 && v[0].body_max_n === 0 && v[0].body_nfa_n === 0 && v[0].ib_line_ok && v[0].has_new_sentence && !v[0].updated_at_is_original, JSON.stringify(v));
ok("verify after: AFTER (pinned md5), deposit terms 0, once-rule 0/0 in the body, updated_at bumped");
assert.equal(row.tk, seed.find((x) => x.id === ID).tk); ok("key_takeaways unchanged");
assert.deepEqual(decoys(afterApply), decoys(seed)); ok("same slug in another level + another lesson with the same sentence untouched");

r = await run(APPLY);
assert.equal(r.error, undefined); assert.ok(r.notices.some((x) => /already in the AFTER state\. Nothing changed/.test(x)));
assert.deepEqual(await snap(), afterApply); ok("apply rerun: NOTICE, no-op (no row or updated_at changed)");

r = await run(REVERT);
assert.equal(r.error, undefined, r.error); assert.ok(r.notices.some((x) => /1 row restored/.test(x)));
assert.deepEqual(await snap(), seed); ok("revert: byte-for-byte original incl. updated_at");
v = await verify(); assert.ok(v[0].state === "BEFORE" && v[0].updated_at_is_original); ok("verify after revert: BEFORE, updated_at original");
r = await run(REVERT); assert.equal(r.error, undefined); assert.ok(r.notices.some((x) => /already holds the original text/.test(x))); assert.deepEqual(await snap(), seed); ok("revert rerun: NOTICE, no-op");

// Drift before apply: one character changed -> abort, nothing written.
await db.query("update public.lessons set content = replace(content, 'Steps to get started', 'Steps to get  started') where id = $1", [ID]);
let pre = await snap();
r = await run(APPLY); assert.match(r.error ?? "", /ABORTED, nothing changed: expected the pinned BEFORE state, found DRIFTED/); assert.deepEqual(await snap(), pre);
ok("drift before apply: RAISE, 0 rows written");
r = await run(REVERT); assert.match(r.error ?? "", /revert ABORTED, nothing changed: expected the exact AFTER state, found DRIFTED/); assert.deepEqual(await snap(), pre);
ok("drift: revert RAISEs too, row kept");
await db.query("update public.lessons set content = $2, updated_at = $3::timestamptz where id = $1", [ID, ORIG, UPD]);
assert.deepEqual(await snap(), seed);

// Edited after apply: revert must not clobber it.
assert.equal((await run(APPLY)).error, undefined);
await db.query("update public.lessons set content = content || E'\\nNew paragraph added later.' where id = $1", [ID]);
pre = await snap();
r = await run(REVERT); assert.match(r.error ?? "", /found DRIFTED/); assert.deepEqual(await snap(), pre);
ok("edited after apply: revert RAISEs (DRIFTED), later edit kept");
await db.query("update public.lessons set content = $2, updated_at = $3::timestamptz where id = $1", [ID, ORIG, UPD]);

// key_takeaways changed (content still BEFORE) -> DRIFTED, abort.
await db.query("update public.lessons set key_takeaways = key_takeaways || '[\"x\"]'::jsonb where id = $1", [ID]);
r = await run(APPLY); assert.match(r.error ?? "", /found DRIFTED/); ok("key_takeaways drift: apply RAISEs");
await db.query("update public.lessons set key_takeaways = $2::jsonb where id = $1", [ID, TKV]);

// Wrong level / missing row.
await db.query("update public.lessons set slug = 'moved' where id = $1", [ID]);
r = await run(APPLY); assert.match(r.error ?? "", /found WRONG_LEVEL_OR_SLUG/); ok("wrong slug for the id: RAISE");
await db.query("delete from public.lessons where id = $1", [ID]);
r = await run(APPLY); assert.match(r.error ?? "", /found MISSING/); ok("missing id: apply RAISEs");
r = await run(REVERT); assert.match(r.error ?? "", /found MISSING/); ok("missing id: revert RAISEs");
assert.deepEqual(decoys(await snap()), decoys(seed)); ok("decoys never touched");
console.log(`ALL PASS accm-lesson-deposit-edit local SQL (${n})`);
