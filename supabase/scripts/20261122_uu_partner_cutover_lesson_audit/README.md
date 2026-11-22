# UU partner cutover — lesson / course-content audit

Spec: `/workspace/gfx/design/trading-system/uu-partner-cutover-spec.md` (22 Nov 2026). This is a **read-only audit**. There is **no apply**, no backup, and no revert.

## Prod run (read-only)

- **When:** 22 Nov 2026, 5:27 PM Asia/Manila.
- **What:** `SELECT` only on GFX prod. No `INSERT`, `UPDATE`, `DELETE`, or DDL.
- **Tables (row counts at the time):** `public.lessons` (32), `public.training_lessons` (55), `public.training_courses` (3), `public.training_modules` (12), `public.courses` (1), `public.levels` (6).
- **Fields:** lesson / course-content body columns in those tables (`content`, `key_takeaways`, `examples`, `learning_objective`, `body_md`, `tldr`, `takeaway`, `practice_task`, `summary`, `learning_goal`, `description`, plus titles).
- **Terms (ILIKE, any of):** `discord.gg`, `AZb5Gk9xNP`, `GFX Society Discord`, `PDE x GFX`, `PDE`, `sumali sa Discord`, `Discord community`, `guided training para sa beginners`.
- **Result:** **0 matching rows.** No content edit is required.

## `verify.sql`

Re-run in the Supabase SQL editor anytime. It writes nothing.

1. The first result set is table counts (sanity that the tables are visible).
2. The second result set is hits. **Expect 0 rows.**

If a later run returns any hit, stop and write an idempotent backup / apply / verify / revert script (same pattern as `supabase/scripts/20261115_accm_lesson_deposit_edit/`) instead of applying by hand. Jarvis applies such a script only after QA passes. Do not use this folder for writes.
