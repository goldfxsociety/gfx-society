# GFX Discord VIP verification bot

Official bot app (no self-bot, no user-account automation) for the **PDE x GFX Society** Discord server.
A member uploads an ACCM deposit screenshot, and an admin clicks **Approve VIP**, **Need more info** or **Reject**. The bot assigns **@VIP** (permanent), DMs the member, deletes its copy of the screenshot and keeps only a one-line decision log, which it deletes after 12 months.
Join applications stay native in Discord (out of scope). Spec: `/workspace/gfx/team/specs/discord-verification-bot.md` (Option A).

> **⚠️ NOT DEPLOYED.** No Discord app, Cloudflare resource, secret or Supabase table exists yet. The founder does every step in [Ben's setup checklist](#bens-setup-checklist) himself, after approval.

## Architecture

```
Member in #verify ──/verify-deposit or [Verify deposit] button──► Discord ──signed POST──► Cloudflare Worker (this folder)
                                                                                        │ 1. verify Ed25519 signature (401 if bad), PING→PONG
   modal: privacy notice + File Upload (1 image) ◄── type 9 MODAL ──────────────────────┤
   modal submit ──► Worker: validate type/size, ACK type 5 (ephemeral) within 3 s ───────┤
                    ctx.waitUntil: rate checks → insert pending row (Supabase) →        │
                    download from Discord CDN → sniff bytes → re-upload to #vip-approvals│
                    with [Approve VIP] [Reject] → edit ACK "Natanggap na!"              │
Admin click ──► Worker: admin-ROLE check (every click) → ACK type 6 / note modal → waitUntil:│
   atomic UPDATE … WHERE status='pending' RETURNING * (only one winner) →               │
   disable buttons → [approve: add @VIP] → DM member (fallback: notice in #verify) →    │
   DELETE the #vip-approvals message (the screenshot) → one line to #vip-log            │
Hourly cron (:17) ──► expire pending > 7 days (delete cards) + purge log rows > 12 months│
                      and their #vip-log mirror messages. Never touches roles.          │
```

- **HTTP interactions only.** No Gateway, no intents (so no privileged intents).
- **Files**
  - `src/index.ts`: Worker entry (fetch + scheduled).
  - `src/app.ts`: HTTP endpoint, size cap, signature check.
  - `src/verify.ts`: Ed25519 via Web Crypto.
  - `src/handlers.ts`: flows, edge cases, cron expiry and the 12-month purge.
  - `src/admin.ts`: admin **role** check (`ADMIN_ROLE_IDS`, required).
  - `src/db.ts`: Supabase PostgREST with atomic decisions.
  - `src/discord.ts`: REST client, one 429 retry.
  - `src/payloads.ts`: modal, card, button and command builders.
  - `src/copy.ts`: all Taglish copy.
  - `src/attachments.ts`: type/size checks, magic-byte sniffing, CDN allow-list.
- **State and log:** `public.discord_vip_requests` (migration `supabase/migrations/20261018170000_vip_verification_log.sql`, **not applied**) plus a human-readable mirror in **#vip-log**.
  - Ids, status (`pending|approved|rejected|needs_info|expired`), timestamps, reason code, outcome flags and the mirror message id only.
  - No images, URLs, filenames, usernames, amounts, account numbers or admin notes.
- **Idempotency**
  - `request_id` is the submission's interaction id (primary key).
  - A unique partial index allows one *pending* request per member.
  - Decisions are `PATCH …?request_id=eq.X&status=eq.pending` with `return=representation`. Zero rows back means someone else already decided, and that admin gets an ephemeral "Na-decide na ni @admin."
- **Secrets stay out of the website.** `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` are **Worker secrets** (`wrangler secret put`).
  - They are never in `wrangler.toml`, never in the Vercel/website env, and never in chat or PRs.
  - `wrangler.toml` holds placeholder ids only.
- **Website isolation.**
  - The site's `tsconfig.json` excludes `discord-verify-bot`, `eslint.config.mjs` ignores it, and `.vercelignore` keeps it out of Vercel uploads.
  - This folder has its own `package.json`, lockfile, tsconfig and tests.

### Behaviour and edge cases

| Case | Behaviour |
|---|---|
| Not in #verify / not our server | Ephemeral "Sa #verify lang…" / "Sa GFX server lang…" |
| Already has @VIP | Ephemeral "VIP ka na!". No modal, nothing forwarded. On approve: no role call, flag `already_vip`. |
| Pending request exists | "May pending ka pa; hintayin muna ang review." (DB unique index, race-safe) |
| Rejected < 10 min ago / ≥ 5 submissions in 24 h | Cooldown / daily-cap message. After **Need more info** there's no cooldown: the member can resubmit right away (still counts toward 5/24 h). |
| Not an image, > 1 file, too big | Refused before download: PNG/JPG/WEBP only, ≤ `MAX_UPLOAD_BYTES` (8 MiB) and ≤ Discord's `attachment_size_limit`. Bytes are sniffed after download too, so a renamed PDF is refused. |
| Re-upload fails | Pending row deleted. Member sees "Nagka-error, paki-try ulit." |
| Non-admin clicks a button | Ephemeral "Admins lang (with the GFX admin role)…". Checked on **every** click and every admin modal submit. Only members with a role in `ADMIN_ROLE_IDS` pass; **Manage Roles or Administrator alone is not enough**. |
| Admin's own request | Refused for Approve, Need more info and Reject. Another admin must decide. |
| **Need more info** | The admin types a short note (5–300 chars). The member gets a Taglish DM with the note, how to resubmit and the IB line. The status becomes `needs_info`, the card is deleted and one log line is written. The note is never stored. |
| Double-click / two admins | One winner (atomic update). Others get "Na-decide na ni @admin." |
| DMs closed (50007) | Decision still applies. #verify gets "@member may update sa VIP verification mo… please run `/verify-status`" with no details. `/verify-status` answers ephemerally. Flag `dm_failed`. For Need more info, the admin's note isn't stored, so `/verify-status` gives the generic resubmit requirements. |
| Member left (10007) | No DM. Card deleted, flag `member_left`. |
| Role hierarchy wrong (50013) | Decision **reverted to pending** and buttons re-enabled. #vip-approvals gets "Ilipat ang bot role sa itaas ng @VIP". Retry after fixing. |
| Pending > 7 days | Hourly cron expires it, deletes the card and screenshot, and writes a log line (`admin system`). |
| Decided > 12 months | Hourly cron deletes the DB row and the bot's #vip-log mirror message (single-message DELETE). |
| @VIP removal | **Never.** @VIP is permanent; there is no re-verification, and no code path removes roles. |
| Discord 429 | One retry after `retry_after` (max 3 s). |
| Bad signature / stale timestamp (> 5 min) | 401. Payloads, URLs and tokens are never logged. |

### Copy rules

- Member copy is balanced Taglish (roughly half English) and education-only.
- No income/profit/win-rate claims and no "guaranteed" results. VIP means community access, not results.
- **ACCM is the only accepted broker.** Every member-facing message that names ACCM carries this one line (enforced by `test/payloads.test.ts`): the panel, the upload modal, the reject and need-more-info DMs, and `/verify-status` for rejected or need-more-info results:
  > GFX at ang partner community ay may maaaring kitain na commission mula sa ACCM kung mag-sign up ka through our link. You can use any broker you choose para sa sarili mong trading.
- **Valid deposit** (members see it in the panel and modal; admins see it on every card): an ACCM screenshot showing the member's name or ACCM User ID, dated within the last 30 days. Admins judge the amount. **The bot does not auto-check any of this.**
- The privacy notice is shown **in the upload modal above the file field** and in the #verify panel. It says the screenshot is only for VIP verification and gets deleted after review, only a decision log is kept, plus goldfx.society@gmail.com and the Privacy Notice link.
- Slash command descriptions don't name ACCM, because there's no room for the disclosure in 100 characters.
- `/verify-deposit` opens the modal. It has no attachment option, so the full notice is always seen before upload; a slash option description is capped at 100 characters.
- The founder's name never appears.

## Verified platform limits (official docs, checked 18 Oct 2026)

**Cloudflare Workers Free**: [Limits](https://developers.cloudflare.com/workers/platform/limits/) (page updated 12 Oct 2026) and [Pricing](https://developers.cloudflare.com/workers/platform/pricing/).

| Limit | Free plan | This bot |
|---|---|---|
| Requests | **100,000/day** (resets 00:00 UTC = 8:00 AM PHT). Over the limit: error 1027. | A few per verification (≈ 4–6) |
| CPU time | **10 ms per HTTP request**. Waiting on fetch doesn't count. Cron: 10 ms. | Ed25519 verify is native Web Crypto; the rest is I/O |
| Subrequests | **50 per invocation**; 6 simultaneous open connections | ≤ 10 per flow. Cron per run: expiry ≤ 5 rows (≤ 21) + purge ≤ 20 rows (≤ 22) = ≤ 43 |
| Request body size | **100 MB** (Cloudflare Free/Pro account plan) | Interactions are small JSON; we cap at 256 KB |
| `waitUntil` | Extends execution **up to 30 s** after the response | Download + re-upload of ≤ 8 MiB |
| Memory | 128 MB per isolate | ≤ 8 MiB buffered |
| Worker size | 64 MiB | ≈ 45 KiB (`wrangler deploy --dry-run`) |
| Cron Triggers | 5 per account | 1 used (hourly) |
| Env vars | 64 per Worker, 5 KB each | 12 |

**Commercial use:** Vercel Hobby is "restricted to non-commercial personal use only" ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)). Cloudflare's [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/) has no comparable non-commercial restriction for the Free plan. The Free plan has no SLA.

**Discord**

- The initial response must arrive within **3 s**, or the token is invalidated. Interaction tokens are valid for **15 min** for edits and follow-ups ([Receiving and responding](https://docs.discord.com/developers/interactions/receiving-and-responding#responding-to-an-interaction)).
- `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (5) may only carry `EPHEMERAL`. `DEFERRED_UPDATE_MESSAGE` (6) is for components/modal submits. A modal (9) can't answer a modal submit or a PING (same page).
- The endpoint must verify `X-Signature-Ed25519` / `X-Signature-Timestamp`, reply 401 to invalid ones, and PONG to PING ([Overview → Setting up an endpoint](https://docs.discord.com/developers/interactions/overview#setting-up-an-endpoint-validating-security-request-headers)).
- **Modal limits:** title ≤ 45 chars, 1–5 components. Label ≤ 45 chars, description ≤ 100 chars. **File Upload** (type 19, inside a Label) takes 0–10 files. `file_types` matches the **extension only**, and file size is capped by the user's upload limit. `custom_id` is 1–100 chars ([Component reference](https://docs.discord.com/developers/components/reference#file-upload)).
- **Upload limit:** 20 MiB per file by default (higher with Nitro/boosts). The interaction's `attachment_size_limit` is the effective maximum ([Uploading files](https://docs.discord.com/developers/reference#uploading-files)).
- Attachment CDN URLs are **signed** and expire at `ex` ([Signed attachment CDN URLs](https://docs.discord.com/developers/reference#signed-attachment-cdn-urls)). That's why the bot re-uploads the bytes instead of linking.
- **Rate limits:** global 50 requests/s per bot. Interaction endpoints are not bound to the global limit. 10,000 invalid (401/403/429) requests per 10 min leads to a temporary IP ban ([Rate limits](https://docs.discord.com/developers/topics/rate-limits#global-rate-limit)).
- A bot can only assign roles below its highest role ([Permission hierarchy](https://docs.discord.com/developers/topics/permissions#permission-hierarchy)). `default_member_permissions` applies to commands, not buttons, which is why every click is checked ([Application command permissions](https://docs.discord.com/developers/interactions/application-commands#permissions)).
- **Deleting old messages:** Bulk Delete "will not delete messages older than 2 weeks" ([Bulk Delete Messages](https://docs.discord.com/developers/resources/message#bulk-delete-messages)). So the 12-month purge deletes each mirror line with the single **Delete Message** endpoint on the bot's own message, which has no age limit and needs no Manage Messages permission.
  - Discord rate-limits deletes of old messages more tightly. On a 429 the bot retries once, then stops and continues next hour.
  - Each hourly run purges at most 20 rows, which is about 480 a day.
  - Lines that admins post by hand in #vip-log, or mirror lines whose id wasn't saved, aren't purged automatically.
- Error codes handled: 10007 unknown member, 10008 unknown message, 50007 cannot DM, 50013 missing permissions ([JSON error codes](https://docs.discord.com/developers/topics/opcodes-and-status-codes#json-json-error-codes)).

## Configuration

| Name | Where | Notes |
|---|---|---|
| `DISCORD_APP_ID`, `GUILD_ID`, `VIP_ROLE_ID`, `VERIFY_CHANNEL_ID`, `APPROVALS_CHANNEL_ID`, `LOG_CHANNEL_ID` | `wrangler.toml` `[vars]` | Snowflake ids (not secret); placeholders now |
| `ADMIN_ROLE_IDS` | `[vars]` | **Required**, comma-separated admin role id(s). Only these roles can Approve, Need more info or Reject; Manage Roles or Administrator alone is not enough. If it's empty, the Worker returns 500 (fails closed). |
| `SUPABASE_URL` | `[vars]` | `https://<ref>.supabase.co` |
| `MAX_UPLOAD_BYTES` | `[vars]` | Default 8 MiB |
| `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` | **Worker secrets only** | `npx wrangler secret put <NAME>` or the Cloudflare dashboard (type *Secret*). **Never** in the website/Vercel env, git, chat, email or Discord. |

## Local dev

```bash
cd discord-verify-bot
npm ci
npm run typecheck && npm test        # vitest, Discord + Supabase mocked; no network
npm run build:dry                    # local bundle only (wrangler deploy --dry-run), deploys nothing
cp .dev.vars.example .dev.vars       # TEST-server values only; git-ignored
npx wrangler dev                     # http://localhost:8787 (expose with a tunnel only for a private test server)
```

## QA test plan (private test server only, never the live PDE server)

Setup:

- A separate test Discord server.
- A separate **test** Discord app.
- A Supabase **branch or local DB** with the migration applied.
- `wrangler dev` behind a tunnel, or a test Worker on the tester's own Cloudflare account.
- Three accounts: member, admin A, admin B.

1. **Endpoint:** saving the Interactions Endpoint URL succeeds (PING plus Discord's invalid-signature probe). `curl -X POST` without headers gives 401.
2. **Happy path, command:** `/verify-deposit` in #verify opens the modal with the privacy notice above the upload. Upload a PNG and you get the ephemeral "Natanggap na!".
   - The card appears in #vip-approvals with the image as `vip-<id>.png`, the member mention and two buttons, and pings nobody.
   - The DB row is `pending` with ids only.
3. **Happy path, button:** `npm run post-verify-panel`, then **Verify deposit** gives the same result.
4. **Approve:** the card shows the valid-deposit guidance and three buttons. Member gets @VIP and the DM. The card is deleted. #vip-log gets one line. The row is `approved`, `approval_message_id` null.
5. **Reject:** pick a reason and note. The DM has the Taglish reason and note. The row has `reason_code` only; the note is not stored. The card is deleted.
6. **Double click / two admins:** both click Approve within 1 s. One role add, one DM, one log line. The other admin gets "Na-decide na ni …".
7. **Non-admin click:** use (a) a member with View access but no admin role, and (b) a member with **Manage Roles / Administrator but no admin role**. All 3 buttons give an ephemeral refusal and nothing changes. A member with the admin role succeeds.
7b. **Need more info:** click it and type a note. The member's DM has the note, the resubmit steps and the IB line. The row is `needs_info`, the card is deleted and #vip-log gets a line. The member can resubmit immediately.
8. **Closed DMs:** member disables server DMs, admin approves. The #verify notice appears without details, `/verify-status` shows the result ephemerally, and the flag is `dm_failed`.
9. **Already VIP:** `/verify-deposit` answers "VIP ka na!".
10. **Pending / cooldown / cap:**
    - A second submit while pending gives the pending message.
    - Right after a reject you get the cooldown.
    - A 6th submission in 24 h gives the cap.
11. **File checks:**
    - A `.pdf` is filtered by Discord.
    - A PDF renamed `.png` is refused after sniffing.
    - A > 8 MiB image is refused.
    - A GIF is refused.
12. **Hierarchy:** move the bot role below @VIP and approve. The alert appears, the row is back to pending and the buttons are re-enabled. Fix the order and approve again: it works.
13. **Member left:** member leaves, admin approves. No DM, flag `member_left`, card deleted.
14. **Expiry:** set a test row's `created_at` 8 days back and trigger the cron (`wrangler dev --test-scheduled`, then `curl "http://localhost:8787/__scheduled?cron=17+*+*+*+*"`). The row becomes expired and the card is deleted.
14b. **Retention:** set a decided test row's `decided_at` 13 months back, keeping a real `log_message_id`, and trigger the cron. The row and its #vip-log line are deleted, and @VIP stays on the member.
15. **Deletion check:** after decisions, #vip-approvals has no screenshots left. The ephemeral ACK never showed the image.
16. **Copy review:** balanced Taglish, education-only, no income claims, the IB line wherever ACCM is named, no founder name.

## Ben's setup checklist

Do these yourself, in order. **Never paste the token, public key or Supabase key into chat, email, Discord or a PR.**

**A. Discord Developer Portal**

1. Go to https://discord.com/developers/applications and click **New Application**. Name it **GFX Verifier** and accept the terms.
2. On **General Information**:
   - Set the **App Icon** to the GFX logo: `src/app/icon.png` in this repo (512×512 PNG; the site favicon). `src/app/apple-icon.png` is a 180×180 version.
   - Copy the **Application ID** (it goes in `wrangler.toml` as `DISCORD_APP_ID`; not secret) and the **Public Key** (step C3).
3. On **Installation**, set **Installation Contexts** to **Guild Install** only, and set **Install Link** to **None**. Discord requires this before Public Bot can be turned off.
4. On **Bot**:
   - Set the username **GFX Verifier** and the avatar to `src/app/icon.png`.
   - Turn **Public Bot** OFF and **Requires OAuth2 Code Grant** OFF.
   - Under **Privileged Gateway Intents**, leave all three OFF (Presence, Server Members, Message Content). The bot needs no intents.
5. On **Bot**, click **Reset Token** and copy it **straight into** `npx wrangler secret put DISCORD_BOT_TOKEN` (step C3). Don't save it anywhere else. If it's ever exposed, Reset Token again and re-run the secret command.

**B. Supabase (after you approve the migration)**

1. Apply `supabase/migrations/20261018170000_vip_verification_log.sql` (see *Migration apply steps* below). Run `supabase/verification/20261018170000_vip_verification_log_verify.sql`: every `ok` must be `true` and the counts 0.
2. Go to Supabase dashboard → Project Settings → API Keys and **create a dedicated secret key** named `discord-verify-bot`, so it can be revoked alone. Copy it **straight into** `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`.

**C. Cloudflare Workers (free plan)**

1. Create or log in to a Cloudflare account. On your machine, `cd discord-verify-bot && npm ci && npx wrangler login`.
2. Turn on Developer Mode in Discord (User Settings → Advanced → Developer Mode). Then right-click → **Copy ID** for the server, the @VIP role, **your GFX admin role** (`ADMIN_ROLE_IDS`, required), #verify, #vip-approvals and #vip-log. Put them in `wrangler.toml` `[vars]` with `DISCORD_APP_ID` and `SUPABASE_URL`. These ids are not secret.
3. Set the secrets. Each command prompts, and nothing is echoed:
   ```bash
   npx wrangler secret put DISCORD_PUBLIC_KEY
   npx wrangler secret put DISCORD_BOT_TOKEN
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
   Alternatively use the dashboard: Workers & Pages → gfx-discord-verify-bot → Settings → Variables and Secrets → type **Secret**. Do **not** add any of these to the website's Vercel env.
4. Run `npm run deploy` (`wrangler deploy`) and note the URL, e.g. `https://gfx-discord-verify-bot.<your-subdomain>.workers.dev/`.

**D. Connect Discord to the Worker**

1. Developer Portal → **General Information** → **Interactions Endpoint URL**: paste the Worker URL and click **Save**. Discord sends a PING and an invalid-signature probe, and it only saves if the bot answers correctly.
2. **Invite the bot** with:
   `https://discord.com/oauth2/authorize?client_id=<APP_ID>&permissions=268471296&scope=bot%20applications.commands`
   Pick the PDE x GFX Society server and click **Authorize**. Permissions to tick (if using the URL Generator):
   - **View Channels** (1024)
   - **Send Messages** (2048)
   - **Attach Files** (32768)
   - **Manage Roles** (268435456)

   Total **268471296**. Scopes: `bot` and `applications.commands`. **No Administrator**, no Manage Messages, no Manage Server, no Kick/Ban. Embed Links isn't needed (the bot uses no embeds).
   - *Stricter option:* invite with `permissions=268435456` (Manage Roles only) and grant View/Send/Attach purely through the channel overrides in D4.
3. **Role order** (Server Settings → Roles): admins/staff > **GFX Verifier** (the bot's role) > **@VIP** > everyone else. The bot role must sit **directly above @VIP** and below every staff/admin role, with no extra permissions.
4. **Channels and overrides:**

   | Channel | @everyone | Admins | GFX Verifier (bot) |
   |---|---|---|---|
   | **#verify** | ✅ View Channel, Read Message History, Use Application Commands · ❌ Send Messages, Attach Files, Create Threads | ✅ Send Messages | ✅ View Channel, Send Messages (panel + closed-DM notices) |
   | **#vip-approvals** (private) | ❌ View Channel | ✅ View Channel, Read Message History | ✅ View Channel, Send Messages, Attach Files |
   | **#vip-log** (private) | ❌ View Channel | ✅ View Channel, Read Message History | ✅ View Channel, Send Messages |

   Only members with a role in `ADMIN_ROLE_IDS` can Approve, Need more info or Reject; Manage Roles or Administrator alone is not enough. Give that role to every approver.
5. **Register the slash commands** from your machine:
   ```bash
   export DISCORD_APP_ID=<app id> DISCORD_GUILD_ID=<server id>
   read -s DISCORD_BOT_TOKEN && export DISCORD_BOT_TOKEN   # paste, nothing shows
   npm run register-commands                             # registers /verify-deposit and /verify-status
   ```
6. **Post the panel:**
   ```bash
   export DISCORD_VERIFY_CHANNEL_ID=<#verify id>
   npm run post-verify-panel
   ```
   Then pin the message. Run `unset DISCORD_BOT_TOKEN` when done.
7. Tell admins:
   - A valid deposit is an **ACCM screenshot showing the member's name or ACCM User ID, dated within the last 30 days**. Admins judge the amount; the bot doesn't check any of this.
   - **Don't save, download or forward screenshots.** The bot deletes its copy after the decision, but downloads and screenshots can't be recalled.
   - @VIP is permanent. The bot never removes it, so remove it by hand only if needed.
8. Run the QA plan on a **test server first**, then flip to the live server ids.

## Migration apply steps (only after the founder's OK)

1. Read `supabase/migrations/20261018170000_vip_verification_log.sql`. It creates one table and four indexes and enables RLS with no policies. It **explicitly revokes ALL** on the table from PUBLIC, anon and authenticated, and grants service_role select/insert/update/delete. It touches nothing else (no default-privileges changes).
2. Apply it (Supabase SQL editor or `apply_migration` with name `vip_verification_log`). It's re-runnable: a second run is a no-op.
3. Run `supabase/verification/20261018170000_vip_verification_log_verify.sql`. Expect:
   - checks 1, 3c, 4, 5, 6, 7, 8 and 10: `ok = true`
   - check 2: `policies = 0`
   - check 3b: `acl_entries = 0`
   - checks 3 and 3d: 0 rows
   - check 9: `bad = 0`
4. Only then set the Worker secret and deploy.

## Decided defaults (founder, 18 Oct 2026)

1. **Retention:** decision log rows are deleted 12 months after `decided_at`, together with their #vip-log mirror lines (hourly Worker cron, not pg_cron). Pending requests expire after 7 days.
2. **Approvers:** only members with a configured admin role (`ADMIN_ROLE_IDS`, required). Manage Roles or Administrator alone is not enough. Self-decisions stay blocked.
3. **Valid deposit:** an ACCM screenshot showing the member's name or ACCM User ID, dated within the last 30 days. Admins judge the amount; the bot doesn't auto-check.
4. **@VIP is permanent.** There's no re-verification, and nothing removes roles.
5. **Closed DMs:** a no-details mention in #verify plus `/verify-status`.
6. **ACCM only.** Member copy names ACCM with the one-line IB disclosure.
7. **Bot:** name "GFX Verifier", avatar `src/app/icon.png`, plus a "Need more info" button.
8. **Privacy paragraph:** stays a draft (`docs/privacy-paragraph.md`). The site Privacy Notice isn't edited here.

## Remaining notes

- Rows decided before the bot started storing `log_message_id` would have no mirror id. That doesn't apply yet, since nothing is deployed.
- After Need more info, the note goes in the DM only. If DMs are closed, the member sees generic requirements through `/verify-status`.
