# Lesson risk/NFA de-dupe: 13 Academy lesson rows

Spec: `/workspace/gfx/design/trading-system/lesson-risk-dedupe-spec.md` (DB body edits A to D). These are content edits to `public.lessons`, not a migration. They are applied by an operator (Jarvis) in the Supabase SQL editor. Ship the code PR first: its RiskFooter change (`RISK_EDU_LINE`) carries the one risk sentence and the one NFA line on every lesson page.

## Run order
1. `verify.sql`: read-only "before" check. Expect, per row: `apply_state = pending`, plus the old-string counts below.
2. `01_backup.sql`: creates `public.lessons_backup_20261115_risk_dedupe` (RLS on, no API grants) and copies the 13 rows. Expect `backed_up_rows = 13`. A rerun keeps the first copy.
3. `02_apply.sql`: one guarded UPDATE in a transaction.
   - The first run returns 13 slugs. A rerun returns 0.
   - Rows without a backup row are never changed.
   - Each edit only fires while its old text is present.
4. `verify.sql`: "after" check. Expect every row to show:
   - `apply_state = done`;
   - `closing_n = 0`, `mid_short_n = 0`, `disc_old_n = 0`, `max_old_n = 0`;
   - `tk_last_is_short = false`;
   - `body_max_n = 0` and `body_nfa_n = 0`;
   - `opening-your-accm-account` alone has `max_new_n = 1`;
   - `content_md5` equals the `content_md5_after_apply` from step 1.
5. Only if needed, `03_revert.sql`: restores `content` + `key_takeaways` from the backup. It only writes rows that differ, so a rerun returns 0. It restores the whole field, so don't run it after anyone else has edited these lessons. Then rerun `verify.sql`: it should match step 1 (`apply_state = pending`).

## Before (read-only SELECT on prod, 15 Nov 2026 PHT)
| slug | edit | closing_n | mid_short_n | tk_last_is_short | disc_old_n | max_old_n | body_max_n | body_nfa_n |
|---|---|---|---|---|---|---|---|---|
| what-is-the-financial-market | A | 1 | 1 | f | 0 | 0 | 2 | 1 |
| stocks-vs-forex-vs-gold | A | 1 | 1 | f | 0 | 0 | 2 | 1 |
| how-do-traders-make-money | A | 1 | 1 | f | 0 | 0 | 2 | 1 |
| bull-market-vs-bear-market | A | 1 | 1 | f | 0 | 0 | 2 | 1 |
| what-is-a-spread | A | 1 | 1 | f | 0 | 0 | 2 | 1 |
| what-is-a-broker | B | 1 | 0 | f | 0 | 0 | 1 | 1 |
| candlestick-anatomy | B | 1 | 0 | f | 0 | 0 | 1 | 1 |
| candlestick-patterns | B | 1 | 0 | f | 0 | 0 | 1 | 1 |
| pips-lots-and-leverage | B | 1 | 0 | f | 0 | 0 | 1 | 1 |
| types-of-orders | B | 1 | 0 | f | 0 | 0 | 1 | 1 |
| cents-account-your-first-real-money-practice | B + C | 1 | 0 | t | 0 | 0 | 2 | 1 |
| real-money-and-your-emotions | C | 0 | 0 | t | 0 | 0 | 1 | 0 |
| opening-your-accm-account | D | 0 | 0 | f | 1 | 1 | 1 | 1 |

A read-only dry run of the same transform (the CTE in `verify.sql`) gave `body_max_n = 0` and `body_nfa_n = 0` on all 13 rows. Each cut joins cleanly: the previous paragraph, a blank line, then the `## ` heading. The IB disclosure on `opening-your-accm-account` is kept. The 19 other published lessons had 0 of both, so they need no edit.

## Exact strings
- CLOSING (A, B; trailing paragraph, removed with its leading blank line): `Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.`
- SHORT (A; its own line right before a `## ` heading, removed with its line break): `Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.`
- C: the last `key_takeaways` item, removed only when it is exactly SHORT.
- D (`opening-your-accm-account`):
  - `Disclosure: ACCM is GFX's partner broker. Education only, not financial advice.` becomes `Disclosure: ACCM is GFX's partner broker.`
  - `Max 1% risk per trade, stop-loss on every trade.` becomes `Use no more than 1% of the account on each trade, with a stop-loss on every trade.`
