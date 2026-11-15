# Explorer vs Linked tiers (Sprint 3): DB change

Spec: `/workspace/gfx/design/trading-system/explorer-linked-tiers-spec.md` v1.1 (§2.4, §4, §6). **File only, not applied.** Applying it to prod needs QA PASS plus Jarvis's go. **Ship order: apply this migration first, then merge / deploy PR #75.** The PR #75 app sends access-request consent version `request-v2` (Privacy v1.6), and the live `public.submit_access_request` accepts `request-v1` only. If the app deployed first, every access-request submit would fail with the neutral error until the apply. The migration is safe with the current production app: the extra Gold Reset branch is unreachable there (the old proxy still sends non-members to the join door), the new import functions run only when an operator calls them, and `request-v1` stays accepted. Note: a Vercel preview that talks to the production database has the same request-submit failure until the apply.

What the migration changes (details in the header of the migration file):
- `public.has_course_access` and `public.my_payment_info` add one branch. A confirmed, `join-v2`-consented signed-in user (an Explorer) gets Gold Reset only (slug `gold-reset`, price 0, open). The paid courses and the S8 owner path are unchanged.
- New `private.upsert_allowlist(rows jsonb, source_file text, actor text)`. This is the anytime add-only import: it never deletes and never starts grace. It then runs `match_access_requests()` and activates consented users. It returns counts only.
- New `private.import_allowlist_full(rows, source_file, actor)`. This wrapper calls the unchanged `private.import_allowlist(jsonb)` (still the only path that downgrades), then runs the same activation, then labels the audit row.
- Audit columns are added to `private.allowlist_refresh_log`: `mode`, `source_file`, `actor`, `updated`, `consented_activated`, `conflicts` and `skipped`.
- `public.submit_access_request` accepts `request-v2` as well as `request-v1`. That is the live body with one line changed (the consent-version check), and the grants are the same. `request-v1` rows stay valid with no re-consent, because the data and the purpose are unchanged.
- It adds no public table, no new grant, no User ID column and no plaintext email. New functions live in `private` with all privileges revoked.

## Run order
1. **`supabase/verification/20261115120000_explorer_linked_tiers_verify.sql`** (read-only, "before"). Expect 18 rows:
   - **True (9 rows):** the 6 always rows (`pre:`, `unchanged:`, no prefix) and the 3 `revert:` rows.
   - **False:** all 9 `apply:` rows.
   - If any always row is false, stop and send the output back to the PR.
2. **`supabase/migrations/20261115120000_explorer_linked_tiers.sql`**. One file, re-runnable (idempotent). Apply it after `20261111130000_accm_confirm_mailer.sql` (prod version `20261111073716`).
3. **The verify file again** ("after"). Expect 15 true rows: the 6 always rows and the 9 `apply:` rows. The 3 `revert:` rows are false by design.
4. **Then merge / deploy PR #75.**
5. **Only if needed: `revert.sql`** (this folder). It runs in one transaction and is re-runnable. **Revert the PR #75 app first**: the reverted `submit_access_request` accepts `request-v1` only.
   - It puts the three public functions back to their exact live 15 Nov bodies and drops the 7 private functions and the 7 audit columns.
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
- the request consent version: `request-v2` refused before the apply and after the revert, accepted and stored after the apply; `request-v1` still accepted;
- the audit log;
- revert plus re-apply.
