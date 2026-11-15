# Lesson risk/NFA de-dupe: 13 Academy lesson rows

Spec: `/workspace/gfx/design/trading-system/lesson-risk-dedupe-spec.md` (DB body edits A to D). These are content edits to `public.lessons`, not a migration. An operator (Jarvis) applies them in the Supabase SQL editor. Ship the code PR first: its RiskFooter carries the one risk sentence and the one NFA line on every lesson page.

The scripts create no table, schema, RLS policy or grant. Only `public.lessons` is written (by `02_apply.sql`, or `03_revert.sql` if a rollback is needed). Every row is matched by primary key `id`, and its `level_id` + `slug` are checked as a sanity guard. Lessons are unique on `(level_id, slug)`, not on slug.

## Run order
1. **`verify.sql`** (read-only): the "before" check.
   - Expect 13 rows, every one with `state = BEFORE`, `level_slug_ok = true` and `updated_at_is_original = true`.
   - Expect `total_before = 13` and `total_after = 0`, plus the before counts in the table below.
2. **`01_backup.sql`** (read-only): exports the 13 live rows as JSON. Every edited column is included (`content`, `key_takeaways`, `updated_at`), with `id`, `level_id`, `slug` and md5s.
   - Expect `rows = 13`, `all_level_slug_ok = true`, `all_before = true`.
   - **Save the `lessons_backup_json` cell to a file**, e.g. `lessons-backup-20261115-risk-dedupe.json`, and keep it with the change record.
3. **`02_apply.sql`**: one transaction with one DO block.
   - **Success:** the NOTICE `13 rows updated and verified against the AFTER md5s.`
   - **Rerun:** the NOTICE `all 13 rows already in the AFTER state. Nothing changed.` Nothing is written and nothing is raised.
   - **Aborts with `RAISE EXCEPTION` and writes nothing when:**
     - any id is missing, or has a different `level_id`/`slug`;
     - any row is drifted, or the 13 are mixed (some before, some after);
     - the post-update md5 check fails.
   - The message lists each slug with its state (`BEFORE`, `AFTER`, `DRIFTED`, `MISSING`, `WRONG_LEVEL_OR_SLUG`). Don't edit the guard; send the message back to the PR.
4. **`verify.sql`**: the "after" check.
   - Expect every row to show `state = AFTER`, `body_max_n = 0`, `body_nfa_n = 0` and `updated_at_is_original = false`.
   - Expect `total_after = 13`.
5. **Only if needed: `03_revert.sql`**. It is self-contained: it embeds the exact original `content`, `key_takeaways` and `updated_at` of the 13 rows as dollar-quoted literals (tag `$lrd_orig_20261115$`). They were taken from a read-only prod SELECT on 15 Nov 2026, and their md5s were checked against prod.
   - **Success:** the NOTICE `13 rows restored (content, key_takeaways, updated_at) and verified against the original md5s.`
   - **Rerun:** the NOTICE `all 13 rows already hold the original text. Nothing changed.`
   - **Aborts unless all 13 rows are in the exact AFTER state**, so a lesson edited after the apply is never overwritten. In that case, restore by hand from the step 2 JSON.
   - Afterwards, `verify.sql` should show `state = BEFORE` and `updated_at_is_original = true` on all 13 rows.

Pinned md5s: `md5(content)` and `md5(key_takeaways::text)`. The before values come from prod (read-only, 15 Nov 2026 PHT). The after values were computed from those originals, and `02_apply.sql` re-checks them after its UPDATE.

## Local test (offline)
`local-test.mjs` runs everything on an in-memory PGlite, never a hosted DB. It seeds the 13 originals from the literals in `03_revert.sql`, plus a same-slug lesson in another level and an unrelated 1% lesson.

It checks:
- the exact-13 apply;
- the rerun no-op;
- that the decoys are untouched;
- a byte-for-byte revert, including `updated_at`, and the revert rerun no-op;
- that drift, mixed states, an edit after apply, a wrong level and a missing id all abort with 0 rows written.

```
npm i --no-save --prefix /tmp/pgl @electric-sql/pglite
PGLITE=/tmp/pgl/node_modules/@electric-sql/pglite/dist/index.js node supabase/scripts/20261115_lesson_risk_dedupe/local-test.mjs
```

## The 13 rows (before counts from read-only prod SELECTs)
| slug (level) | edit | body_max_n | body_nfa_n | before → after |
|---|---|---|---|---|
| what-is-the-financial-market (foundations) | A | 2 | 1 | 0 / 0 |
| stocks-vs-forex-vs-gold (foundations) | A | 2 | 1 | 0 / 0 |
| how-do-traders-make-money (foundations) | A | 2 | 1 | 0 / 0 |
| bull-market-vs-bear-market (foundations) | A | 2 | 1 | 0 / 0 |
| what-is-a-spread (foundations) | A | 2 | 1 | 0 / 0 |
| what-is-a-broker (elementary) | B | 1 | 1 | 0 / 0 |
| candlestick-anatomy (elementary) | B | 1 | 1 | 0 / 0 |
| candlestick-patterns (elementary) | B | 1 | 1 | 0 / 0 |
| pips-lots-and-leverage (elementary) | B | 1 | 1 | 0 / 0 |
| types-of-orders (elementary) | B | 1 | 1 | 0 / 0 |
| cents-account-your-first-real-money-practice (elementary) | B + C | 2 | 1 | 0 / 0 |
| real-money-and-your-emotions (graduation) | C | 1 | 0 | 0 / 0 |
| opening-your-accm-account (graduation) | D | 1 | 1 | 0 / 0 |

The other 19 published lessons have none of these strings and are not touched. After the edits, every lesson page shows one visible risk line and one NFA, both from the footer.

## Exact strings
- **CLOSING** (A, B): the trailing paragraph, removed with its leading blank line: `Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.`
- **SHORT** (A): its own line right before a `## ` heading, removed with its line break: `Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.`
- **C**: the last `key_takeaways` item, which is exactly SHORT.
- **D** (`opening-your-accm-account`, wording approved by Design):
  - `Disclosure: ACCM is GFX's partner broker. Education only, not financial advice.` becomes `Disclosure: ACCM is GFX's partner broker.`
  - `Max 1% risk per trade, stop-loss on every trade.` becomes `Risk no more than 1% of your account on each trade, with a stop-loss on every trade.`
