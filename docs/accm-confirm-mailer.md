# ACCM email confirmation mailer (Gmail SMTP)

If someone requests Trading System access with an ACCM email that is different from their Academy email, that
address only counts after they confirm it from its inbox. This page covers how the confirmation mail is sent and
what has to be in place before it is switched on.

**Status: OFF.** Nothing is sent until every go-live step below is done with Jarvis's go.

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

## The two switches (both default off)

| Switch | Where | Off means |
|---|---|---|
| `ACCM_CONFIRM_MAIL_LIVE` | `src/lib/members/access-request.ts` (constant) | No ACCM field, no SMTP env read, no mail, the confirm page has no button, `/privacy` shows v1.4 |
| `accm_confirm_mail_live` | `private.app_settings` (migration `20261111130000`) | The DB refuses ACCM emails (`accm_email_disabled`), issues no tokens, and confirm answers `invalid` |

## Vercel env vars (Production). Set them only with Jarvis's go; this PR changes no env.

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

## Go-live checklist (each step needs Jarvis's go)
1. PR #67 is merged and `20261111120000_access_requests.sql` is applied (done before this PR).
2. Apply `supabase/migrations/20261111130000_accm_confirm_mailer.sql`, then run
   `supabase/verification/20261111130000_accm_confirm_mailer_verify.sql`: every row must be true.
   Note: in PR #67's verify, the row `confirm_accm_email: anon + authenticated` turns false after this migration.
   That is intended (QA N1 removes anon access). Every other row stays true.
3. Hosted check that the service-role key works for this RPC. The production key had 401 problems before, and the
   purge cron also depends on it.
4. Set the three `GFX_SMTP_*` env vars on Vercel.
5. Set the v1.5 "Last updated" date in `src/content/legal/privacy-notice-v1.5.md`, flip `ACCM_CONFIRM_MAIL_LIVE` to
   `true` in a reviewed PR, and deploy.
6. Turn the DB switch on (SQL editor):
   `update private.app_settings set value = 'true' where key = 'accm_confirm_mail_live';`
   The verify row "mail switch is off" then reads false by design.
7. Ben runs one end-to-end test with his own second address.

To roll back, set the DB switch to `'false'` (takes effect immediately) and/or flip the constant back and redeploy.

No Supabase Auth URL, redirect or CORS settings are needed. The link is a plain site page, and the mail doesn't go
through Supabase Auth.
