# Explorer vs Linked tiers (Sprint 3): DB change

Spec: `/workspace/gfx/design/trading-system/explorer-linked-tiers-spec.md` v1.1 (§2.4, §4, §6). **File only, not applied.** Applying it to prod needs QA PASS plus Jarvis's go. Ship order: merge the code PR, then apply the migration. The app code is safe either way: before the apply, the DB still answers `not_member` for Explorers on Gold Reset, so they see the consent / join door and nothing breaks. One rough edge until the apply: an Explorer who has already consented and opens a Gold Reset lesson is sent back to the join page, because the DB still says `not_member`. So apply soon after the merge.

What the migration changes (details in the header of the migration file):
- `public.has_course_access` and `public.my_payment_info` add one branch. A confirmed, `join-v2`-consented signed-in user (an Explorer) gets Gold Reset only (slug `gold-reset`, price 0, open). The paid courses and the S8 owner path are unchanged.
- New `private.upsert_allowlist(rows jsonb, source_file text, actor text)`. This is the anytime add-only import: it never deletes and never starts grace. It then runs `match_access_requests()` and activates consented users. It returns counts only.
- New `private.import_allowlist_full(rows, source_file, actor)`. This wrapper calls the unchanged `private.import_allowlist(jsonb)` (still the only path that downgrades), then runs the same activation, then labels the audit row.
- Audit columns are added to `private.allowlist_refresh_log`: `mode`, `source_file`, `actor`, `updated`, `consented_activated`, `conflicts` and `skipped`.
- It adds no public table, no new grant, no User ID column and no plaintext email. New functions live in `private` with all privileges revoked.

## Run order
1. **`supabase/verification/20261115120000_explorer_linked_tiers_verify.sql`** (read-only, "before"). Expect 16 rows:
   - **True (8 rows):** the 6 always rows (`pre:`, `unchanged:`, no prefix) and the 2 `revert:` rows.
   - **False:** all 8 `apply:` rows.
   - If any always row is false, stop and send the output back to the PR.
2. **`supabase/migrations/20261115120000_explorer_linked_tiers.sql`**. One file, re-runnable (idempotent). Apply it after `20261111130000_accm_confirm_mailer.sql` (prod version `20261111073716`).
3. **The verify file again** ("after"). Expect 14 true rows: the 6 always rows and the 8 `apply:` rows. The 2 `revert:` rows are false by design.
4. **Only if needed: `revert.sql`** (this folder). It runs in one transaction and is re-runnable.
   - It puts the two public functions back to their exact live 15 Nov bodies and drops the 7 private functions and the 7 audit columns.
   - Allowlist rows added by upserts stay; the next monthly `import_allowlist` reconciles them.
   - Then run the verify file once more. Expect the same result as step 1.

## Using the import (after the apply, operator only, SQL editor)
- **Anytime add-only:** `select private.upsert_allowlist('<rows json>'::jsonb, '<file name>', '<operator>');`
  - Rows are `[{"email": "...", "role": "client" | "sub_ib"}, ...]`. Any other key is ignored.
  - It returns `{added, updated, unchanged, consented_activated, conflicts, skipped, relisted, requests_matched, requests_pending}`. Re-running the same file returns `added = 0, updated = 0`.
- **Monthly full snapshot:** `select private.import_allowlist_full('<rows json>'::jsonb, '<file name>', '<operator>');`
  - This keeps the existing 14-day grace and delete behaviour of `import_allowlist`, then activates consented users.
  - Calling `private.import_allowlist(rows)` directly still works exactly as before, without the activation step.

## Local test (offline)
`node scripts/qa/pglite-explorer-linked-tiers.mjs` runs on in-memory PGlite, never a hosted DB. It covers:
- the verify file before, after and after the revert;
- Explorer, Linked and owner gating through RLS;
- the RPC card states;
- privilege denials;
- upsert counts and idempotency (add-only, partial file, role update, relist after grace);
- the audit log;
- revert plus re-apply.
