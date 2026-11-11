# ACCM email confirmation mailer (Gmail SMTP)

If someone requests Trading System access with an ACCM email that is different from their Academy email, that
address only counts after they confirm it from its inbox. This page covers how the confirmation mail is sent and
what has to be in place before it is switched on.

**Status: going live.** Both migrations are applied in prod (flags off since #68). The go-live PR sets the app flag
`ACCM_CONFIRM_MAIL_LIVE = true` in code; it is merged only after go-live steps (a) to (c) below, with Jarvis's go.

## How it works

1. The user submits `/system/join` with a different ACCM email. The server action calls
   `public.submit_access_request` with the user's own session, and the request becomes `awaiting_email_confirm`.
2. The same server action calls `sendAccmConfirmForUser(user.id)` (`src/lib/members/accm-confirm-send.ts`). The user
   id comes from `supabase.auth.getUser()` on the server, never from the form.
3. That function calls `public.issue_accm_confirm_token(user_id)` with the **service-role** admin client
   (`src/lib/supabase/admin.ts`). The RPC is service_role only, so a user can never read or set their own token.
   It returns the raw ACCM address and a fresh 24-hour single-use token. Only the token's sha256 is stored. The RPC
   allows 3 sends per request per 24 hours.
4. nodemailer sends the mail through `smtp.gmail.com:465` (TLS) from the GFX Gmail account. The link is
   `NEXT_PUBLIC_SITE_URL + /system/join/confirm#token=<64 hex>`. The host is pinned, and the token sits in the URL
   fragment, so browsers never send it to a server: it stays out of request logs, analytics and Referer headers.
5. The user opens the link. The GET page never confirms anything. It moves the token into the tab's
   sessionStorage, removes it from the address bar, and shows an **I-confirm ang ACCM email** button. If the user
   isn't logged in, the page asks them to log in first and then come back.
6. The button POSTs to a server action. `public.confirm_accm_email` runs with the user's own session and only
   confirms when the token's request belongs to `auth.uid()`. Every failure returns the same neutral `invalid`, and
   a mismatch never uses up the token.

Logs only ever carry fixed codes: `smtp_env_missing`, `issue_failed`, `issue_bad_shape`, `smtp_send_failed`,
`admin_env_missing`, plus Supabase error codes. The address, the token and the SMTP password are never logged or
returned.

## The two switches

| Switch | Where | Off means |
|---|---|---|
| `ACCM_CONFIRM_MAIL_LIVE` | `src/lib/members/access-request.ts` (constant; `true` from the go-live PR, rollback = revert PR) | No ACCM field, no SMTP env read, no mail, the confirm page has no button, `/privacy` shows v1.4 |
| `accm_confirm_mail_live` | `private.app_settings` (migration `20261111130000`, prod version `20261111073716`; seeded `'false'`) | The DB refuses ACCM emails (`accm_email_disabled`), issues no tokens, and confirm answers `invalid` |

## Vercel env vars (Production). Set them only with Jarvis's go (go-live step a); no PR changes env.

| Name | Value |
|---|---|
| `GFX_SMTP_USER` | The GFX Gmail address (the same account Supabase custom SMTP already uses for Auth mail) |
| `GFX_SMTP_APP_PASSWORD` | A 16-character Google **app password** for that account (sensitive) |
| `GFX_SMTP_FROM` | For example `GFX Society <the same Gmail address>`. Gmail rewrites any other From address unless it is a verified "Send mail as" alias |

These are read only when `ACCM_CONFIRM_MAIL_LIVE` is true. If any of them is missing, the action fails closed with
the neutral error copy, before a token is issued. `SUPABASE_SERVICE_ROLE_KEY` (already on Vercel) must work for
`issue_accm_confirm_token`.

### Gmail requirements and limits
- App passwords need **2-Step Verification** turned on for the Google account. They aren't offered for accounts
  under Advanced Protection, or when a Workspace admin has turned them off.
- Sending limit: about **500 recipients a day** for a consumer Gmail account (about 2,000 for Google Workspace).
  This quota is **shared** with the Supabase Auth mail sent from the same account (signup confirmations and similar).
  If the account hits the limit, both stop until Google resets it.
- Revoking the app password stops the mailer. Rotating it means updating `GFX_SMTP_APP_PASSWORD` and redeploying.

## Go-live checklist (owned by Jarvis; each step needs his go)
Done: PR #67's migration (prod version `20261111071025`) and PR #68's migration (prod version `20261111073716`) are
applied, and both verify files were run. PR #68 deployed with both switches off.

a. Set `GFX_SMTP_USER`, `GFX_SMTP_APP_PASSWORD` and `GFX_SMTP_FROM` in Vercel **Production** (values above).
b. Hosted check that `SUPABASE_SERVICE_ROLE_KEY` works for `public.issue_accm_confirm_token`. The production key had
   401 problems before, and the purge cron also depends on it.
c. Turn the DB switch on (SQL editor). Harmless while the deployed app flag is still `false`, because the app sends no
   ACCM email then:

   ```sql
   update private.app_settings set value = 'true' where key = 'accm_confirm_mail_live';
   select value from private.app_settings where key = 'accm_confirm_mail_live';  -- expect 'true'
   ```
   The verify row "Q6 switch seeded with its default 'false'" (and the two "N3 guard holds now" rows, once real ACCM
   emails arrive) then read false by design.
d. Merge the go-live PR (sets `ACCM_CONFIRM_MAIL_LIVE = true`; Vercel deploys it). The v1.5 "Last updated" date must
   match the go-live day; bump it in the PR before merging if the merge slips. (The other order, flag before DB
   switch, would leave a window where the ACCM field shows but every ACCM submit gets the generic error.)
   **Storage note (QA G5):** fail-closed protects the mail, not storage. With the DB switch on and the SMTP env
   missing, an ACCM submit still stores the raw address (it's purged within about 8 days, see below) but no mail goes
   out. So keep the a → b → c → d order, and never remove the SMTP env while the DB switch is on. To stop the mailer,
   use the rollback below (app flag off, then DB switch off, then the scrub SQL).
e. Post-deploy smoke checks: `/privacy` shows Version 1.5; `/system/join` shows the ACCM email field to a signed-in
   user with no membership; `/system/join/confirm` answers with `X-Robots-Tag: noindex, nofollow` and
   `Referrer-Policy: no-referrer`; Ben submits once with his own second address, gets the mail (both buttons), confirms
   while signed in, and sees the confirmed copy; the Vercel logs show no `smtp_env_missing`, `admin_env_missing` or
   `issue_failed` codes.

## Migration history: prod versions differ from repo filenames (QA R1)
Both access-request migrations were applied with the Supabase MCP tool, which records the version at apply time:

| Repo file | Prod `supabase_migrations.schema_migrations` version |
|---|---|
| `20261111120000_access_requests.sql` | `20261111071025` |
| `20261111130000_accm_confirm_mailer.sql` | `20261111073716` |

Same SQL, different version keys. The files are not renamed. Before any future `supabase db push` (or anything else
that compares local files to the remote history), repair the remote history so the CLI does not see two unknown
remote versions and two "pending" local files (it would refuse, or try to re-apply them). With Jarvis's go, against the
linked prod project:

```sh
supabase migration list                                            # STOP if anything other than these 4 versions differs
supabase migration repair --status applied  20261111120000 20261111130000   # FIRST: record the repo versions (runs no SQL)
supabase migration repair --status reverted 20261111071025 20261111073716   # THEN: drop the two MCP rows (runs no SQL)
supabase migration list                                            # local and remote now line up
```

Order matters (QA G1): mark the repo versions **applied first**, then mark the MCP versions reverted. In the other order
there is a window where the two repo files look pending, and a `db push` in that window would re-apply PR #67's
migration, which re-grants anon access to `confirm_accm_email`. Rules: stop if `migration list` shows any mismatch other
than these four versions; never use `db push --include-all`; don't run `db push` until the final `migration list` lines up.

`migration repair` only edits the history table; it never runs or reverts migration SQL. Any future migration applied
through MCP has the same issue: either repair it the same way, or apply it with `supabase db push` instead. Nothing
here was run as part of the PRs.

## Unconfirmed addresses are purged after 7 days
A raw ACCM email that is never confirmed is deleted once no unexpired link remains and the request was last submitted
more than 7 days ago (`private.purge_stale_accm_emails()`). The request keeps its hash and goes back to `pending`, so it
is checked on the Academy email only, and the user can update the request to enter an ACCM email again. The purge runs on
every submit and token issue, in the daily cron (`/api/cron/members-cleanup` → `public.purge_member_gate_logs`), and in
the monthly refresh.

**Latency (QA R2): up to about 7 days + 1 day.** The 7 days count from the last submit (`updated_at`). The read path
(`my_join_state`) is read-only and doesn't purge, so if nobody submits, the row goes when the next daily cron runs
(`30 19 * * *` UTC = 03:30 Asia/Manila, and Vercel may start it later within that hour). Until then the join page keeps
showing the "check your inbox" copy. The privacy notice's "after 7 days" means this bound.

## Rollback (reverse order, each step with Jarvis's go)
1. Merge a revert PR that sets `ACCM_CONFIRM_MAIL_LIVE` back to `false`, and let it deploy (the ACCM field disappears,
   no more mail, `/privacy` back to v1.4, which is kept for this).
2. Turn the DB switch off: `update private.app_settings set value = 'false' where key = 'accm_confirm_mail_live';`
   (the DB refuses ACCM emails, issues no tokens, and confirm answers `invalid`).
3. Scrub the raw addresses that are still stored (same as the migration's one-time cleanup; returns nothing, keeps
   no plain email):

   ```sql
   begin;
   update public.access_requests set status = 'pending', accm_email_hash = null, accm_email_confirmed_at = null, updated_at = now()
    where status = 'awaiting_email_confirm';
   delete from private.access_request_accm where accm_email is not null;
   commit;
   ```
4. Re-run `supabase/verification/20261111130000_accm_confirm_mailer_verify.sql`: every row must be true again,
   including both "N3 guard holds now" rows and "Q6 switch seeded with its default 'false'".
5. Optional: remove the three `GFX_SMTP_*` env vars (not needed; they're unread while the flag is false).

No Supabase Auth URL, redirect or CORS settings are needed. The link is a plain site page, and the mail doesn't go
through Supabase Auth.
