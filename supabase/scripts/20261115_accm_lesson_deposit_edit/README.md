# ACCM lesson deposit edit: 1 Academy lesson row

Spec: `/workspace/gfx/design/trading-system/accm-lesson-deposit-edit-spec.md`. This is a content edit to `public.lessons`, not a migration. An operator (Jarvis) applies it in the Supabase SQL editor, **after QA passes and after PR #75 merges**, so the in-app deposit block exists first.

**Target:** `opening-your-accm-account` (level `graduation`).
- Matched by primary key `id` `0a66d41e-7255-4028-8640-caf4497a4adb`, with `level_id` + `slug` checked as a sanity guard.
- Only `content` is written (plus `updated_at`). `key_takeaways` is never changed; it is only md5-checked.
- The scripts create no table, schema, RLS policy or grant.

**Starting point:** PR #74 already edited this lesson on prod. The pinned BEFORE body is the PR #74 AFTER text:
- `md5(content)` = `24802fe754f49fe681c60ea951ae0d6f`
- `updated_at` = `2026-11-15 12:21:35.836247+00`

Both values come from a read-only prod SELECT on 15 Nov 2026 PHT. `verify.sql` was also run read-only on prod: `state = BEFORE`, `deposit_terms_n = 3`.

## The one replacement (field `content`)
- **Old:** `Minimum deposit: $50 (as of Oct 2026), via GCash, Maya, or other e-wallets; check ACCM's site for current terms.`
- **New:** `Deposit details are in the app after you log in; check ACCM's site for current terms.`
- Everything else is unchanged, including:
  - `Risk no more than 1% of your account on each trade, with a stop-loss on every trade.`
  - the IB line `Disclosure: ACCM is GFX's partner broker.`
- AFTER `md5(content)` = `5ca42c8b85241ca36486e0a7a26dff17`.

## Run order
1. **`verify.sql`** (read-only): the "before" check. Expect one row with:
   - `state = BEFORE`, `level_slug_ok = true`, `updated_at_is_original = true`
   - `deposit_terms_n = 3`
   - `body_max_n = 0`, `body_nfa_n = 0`
   - `ib_line_ok = true`, `risk_step_ok = true`, `has_new_sentence = false`
2. **`01_backup.sql`** (read-only): exports the live row as JSON (`content`, `key_takeaways`, `updated_at`, ids, md5s).
   - Expect `rows = 1`, `level_slug_ok = true`, `is_before = true`.
   - **Save the `lesson_backup_json` cell to a file**, e.g. `lesson-backup-20261115-accm-deposit-edit.json`, and keep it with the change record.
3. **`02_apply.sql`**: one transaction with one DO block. It locks the row first (`FOR UPDATE`).
   - **Success:** the NOTICE `1 row updated and verified against the AFTER md5.`
   - **Rerun:** the NOTICE `the row is already in the AFTER state. Nothing changed.` Nothing is written.
   - **Aborts with `RAISE EXCEPTION` and writes nothing when:**
     - the id is missing, or has a different `level_id`/`slug`;
     - the row is not exactly in the BEFORE state (`content` or `key_takeaways` md5 differs = `DRIFTED`);
     - the old sentence is not there exactly once;
     - the post-update md5 check fails.
4. **`verify.sql`**: the "after" check. Expect:
   - `state = AFTER`, `deposit_terms_n = 0`, `has_new_sentence = true`
   - `body_max_n = 0`, `body_nfa_n = 0`
   - `ib_line_ok = true`, `risk_step_ok = true`
   - `updated_at_is_original = false`
   - On the lesson page, the footer still carries the one visible "Max 1% risk per trade" and the one "not financial advice", so the once-rule holds.
5. **Only if needed: `03_revert.sql`**. It is self-contained: the exact original `content` is embedded as a dollar-quoted literal (tag `$alde_orig_20261115$`, md5-checked inside the script), along with the original `updated_at`.
   - **Success:** the NOTICE `1 row restored (content, updated_at) and verified against the original md5 + updated_at.`
   - **Rerun:** the NOTICE `the row already holds the original text. Nothing changed.`
   - **Aborts unless the row is exactly in the AFTER state**, so a lesson edited after the apply is never overwritten. In that case, restore by hand from the step 2 JSON.
   - Afterwards, `verify.sql` should show `state = BEFORE` and `updated_at_is_original = true`.

## Local test (offline)
`local-test.mjs` runs everything on an in-memory PGlite, never a hosted DB.
- **Seeds:** the original from the `03_revert.sql` literal, with `key_takeaways` taken from the PR #74 revert literal and md5-checked. Two decoys: a same-slug lesson in another level, and another lesson quoting the same deposit sentence.
- **Checks:**
  - the single replacement, and 0 matches for `$50|GCash|Maya`;
  - that the IB line and the 1% sentence are kept;
  - the apply rerun no-op;
  - a byte-for-byte revert including `updated_at`, and the revert rerun no-op;
  - that drift, an edit after the apply, `key_takeaways` drift, a wrong slug and a missing id all abort with 0 rows written;
  - that the decoys are never touched.

```
npm i --no-save --prefix /tmp/pgl @electric-sql/pglite
PGLITE=/tmp/pgl/node_modules/@electric-sql/pglite/dist/index.js node supabase/scripts/20261115_accm_lesson_deposit_edit/local-test.mjs
```
