// PGlite check for the course content migration: full migration chain (optionally with #54's lesson migration
// spliced in by timestamp via EXTRA_MIGRATION=<path>), content applied twice (second run must change nothing),
// then the verify script. Local only; never points at a Supabase project.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
import path from 'path';
const R = new URL('../../supabase/', import.meta.url).pathname;
const CONTENT = '20261102170000_course_content.sql';
const db = new PGlite({ extensions: { pgcrypto } });
const x = (s) => db.exec(s);
let fail = 0; const check = (ok, label, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', label, extra); };
await x(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema if not exists auth; create schema if not exists extensions; create schema if not exists storage;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'anon') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true), 'amr', '[{"method":"otp"}]'::jsonb) $$;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;
-- Pre-2026-11-02 migrations depend on tables created outside the repo chain (e.g. "levels"), so start at the
-- members-gate base like pglite-courses-payments.mjs and stub the academy public.lessons table that #54 rewrites,
-- seeded with the old broker wording so the #54 step does real work.
create table public.lessons(id serial primary key, content text, learning_objective text, key_takeaways jsonb,
  examples jsonb, interactive_config jsonb, updated_at timestamptz);
insert into public.lessons(content, learning_objective, key_takeaways, examples, interactive_config) values
  ('Disclosure: GFX''s founder is an Introducing Broker (IB) for ACCM. GFX may earn a commission from ACCM if you sign up through our link. You can use any broker you choose.',
   'Verify any broker''s licence', '["x"]', '[]', '{}');`);
const files = fs.readdirSync(R + 'migrations').filter((f) => f.endsWith('.sql') && f >= '20261102120000').map((f) => [f, R + 'migrations/' + f]);
if (process.env.EXTRA_MIGRATION) files.push([path.basename(process.env.EXTRA_MIGRATION), process.env.EXTRA_MIGRATION]);
files.sort((a, b) => a[0].localeCompare(b[0]));
const order = files.map((f) => f[0]);
check(order[order.length - 1] === CONTENT, 'content migration is last in the chain', order.slice(-4).join(' -> '));
for (const [f, p] of files) {
  try { await x(fs.readFileSync(p, 'utf8')); } catch (e) { check(false, 'apply ' + f, e.message); process.exit(1); }
}
console.log('chain applied:', order.join(' -> '));
const ac = (await db.query('select content, learning_objective from public.lessons')).rows[0];
if (process.env.EXTRA_MIGRATION) check(ac.content === "Disclosure: ACCM is GFX's partner broker." && ac.learning_objective === "Verify a broker's licence", '#54 rewrite survives the content migration', JSON.stringify(ac));
const snap = async () => JSON.stringify((await db.query(`select
  (select md5(string_agg(t::text, '|' order by t.id)) from public.training_modules t) m,
  (select md5(string_agg(t::text, '|' order by t.id)) from public.training_lessons t) l,
  (select md5(string_agg(t::text, '|' order by t.lesson_id)) from private.training_quizzes t) q,
  (select md5(string_agg(t::text, '|' order by t.course_id)) from private.placement_quizzes t) p,
  (select md5(string_agg(t::text, '|' order by t.course_id)) from public.training_capstones t) c,
  (select md5(string_agg(t::text, '|' order by t.id)) from public.lessons t) academy`)).rows[0]);
const before = await snap();
await x(fs.readFileSync(R + 'migrations/' + CONTENT, 'utf8'));
check((await snap()) === before, 're-run of content migration changes nothing (incl. public.lessons from #54)');
if (process.env.EXTRA_MIGRATION) {
  await x(fs.readFileSync(process.env.EXTRA_MIGRATION, 'utf8'));
  check((await snap()) === before, '#54 migration re-run after content changes nothing (neither undoes the other)');
}
const v = (await db.query(fs.readFileSync(R + 'verification/20261102170000_course_content_verify.sql', 'utf8'))).rows;
for (const r of v) check(r.ok === true, 'verify: ' + r.check, JSON.stringify(r.detail));
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
