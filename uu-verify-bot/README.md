# uu-verify-bot — Universe Unlimited Discord onboarding

The Universe Unlimited onboarding bot runs on Cloudflare Workers Free with D1. Copy and rules follow
`design/onboarding-spec.md` (the §10 member DMs are verbatim and checked by `test/copy.test.ts`).
The architecture is the same as `discord-verify-bot/`:

- HTTP interactions with Ed25519 verification (Web Crypto).
- Modals and short D1 reads are answered inline.
- Slow work (image download, review card, roles, DMs) runs in `ctx.waitUntil`.

> This is a **separate Worker and a separate Discord app**. It uses the same Cloudflare account as
> `gfx-discord-verify-bot`, but `name = "uu-verify-bot"`. Never deploy this over, or redeploy, the live PDE GFX Verifier.

## Flows

- **#verify → Client ako**
  - FREE: User ID, IB dropdown, screenshot.
  - VIP ($50+): same, plus "above minimum" confirmation.
  - The dropdown shows display names only (+ "Upline: X"). Its last option is the transfer option ("Wala sa list / ibang IB").
  - More than 24 lines → the member is pointed to `/verify-client` with autocomplete.
- **#verify → IB ako**
  - New Sub-IB under an upline line: ACCM IB email + screenshot.
  - The email is visible to Admins only, via the "Admin: View IB Email" button (logged as `email_viewed`).
  - Approval auto-creates the `Line: {name}` role, the `#review-{slug}` channel and the `ib_lines` row.
- **Review cards**
  - Posted in the referring line's private review channel. They ping that line's reviewers only.
  - Cards show flags: duplicate User ID / email, returning member, upline differs, screenshot missing.
  - Approve / Deny, with deny presets plus a note. The member gets the §10 DM (fallback: `/uu-status`), and the
    decision is logged to D1 and `#admin-log`.
  - The card (with the screenshot) is deleted after the decision.
  - Duplicate User ID needs an Admin to approve. A duplicate IB email blocks approval for everyone.
- **Coach Mike line:** one line, one role, one `#review-coach-mike`, one dropdown entry. Both accounts in
  `COACH_MIKE_DISCORD_USER_IDS` get Coach, can decide Coach Mike cases, and are the escalation root.

## Cron (`*/5 * * * *`, Asia/Manila logic)

Every run is capped at 45 subrequests + D1 queries (`src/meter.ts`) and resumes from a cursor in `cron_runs`.

| Job | Rule |
|---|---|
| 48h escalation | A pending card older than 48h moves to the next upline line's review channel. The screenshot is re-uploaded each hop. It stops at Coach Mike with one `#admin-log` alert. |
| VIP reminder | 00:00 Manila, 7 days before the 1st. DMs every VIP verified before that moment. |
| VIP reset | On the 1st (only starts on Manila days 1–3): VIP role removed from VIPs verified before the reminder window. FREE and Sub-IB are kept. Idempotent per `YYYY-MM` (`cron_runs` + unique `decision_logs` row). |

## Storage (D1)

`migrations/0001_init.sql` creates five tables: `ib_lines`, `members`, `applications`, `decision_logs` and `cron_runs`.

- **No balances or amounts are ever stored.** VIP only stores `vip_above_min = yes/no`.
- `accm_ib_email` is shown to admins only.
- Seed: exactly two launch lines, Coach Mike (top) and GFX (upline Coach Mike, `goldfx.society@gmail.com`).

| File | Purpose |
|---|---|
| `sql/0001_verify.sql` | 7 read-only checks, all must return `ok`. One SELECT per check, because D1 caps compound SELECTs. |
| `sql/seed.template.sql` | Reference only. The real seed is `seed.generated.sql`, written by setup (git-ignored). |
| `sql/seed_verify.sql` | 3 checks after seeding. |
| `sql/0001_revert.sql` | Drops all five tables and un-records the migration. **Export a backup first.** |

### D1 run order (Jarvis, after QA PASS + merge)

Use the same Cloudflare account as `gfx-discord-verify-bot`. Set `CI=1` so `migrations apply` doesn't wait on its
confirm prompt.

```bash
cd uu-verify-bot && npm ci
npx wrangler d1 create uu-verify-bot                          # paste database_id into wrangler.toml
CI=1 npx wrangler d1 migrations apply DB --remote
npx wrangler d1 execute DB --remote --file sql/0001_verify.sql   # 7 × ok
npm run setup-server                                           # offline dry-run: review the plan
npm run setup-server -- --dry-run --online                     # optional GET-only diff (token in env)
npm run setup-server -- --apply                                # creates roles/channels; writes setup.out.json + seed.generated.sql
npx wrangler d1 execute DB --remote --file seed.generated.sql
npx wrangler d1 execute DB --remote --file sql/seed_verify.sql   # 3 × ok
# paste the printed [vars] snippet (role/channel ids) into wrangler.toml
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler deploy
npm run register-commands
# Developer Portal → UU app → Interactions Endpoint URL = https://uu-verify-bot.<subdomain>.workers.dev/interactions
npm run post-verify-panel -- --confirm-ben-ok                   # ONLY with Ben's OK for the public post
```

Revert:

```bash
npx wrangler d1 export uu-verify-bot --remote --output backups/uu-$(date +%F).sql
npx wrangler d1 execute DB --remote --file sql/0001_revert.sql
```

## Server setup (`scripts/setup-server.ts`)

The default mode is an **offline dry-run** with no token and no network.

- `--dry-run --online`: GET-only diff.
- `--apply`: create and update.
- `--post-panels`: only with `--apply --confirm-ben-ok`.

What setup does:

- **Existing guild defaults:** the `@everyone` role, the managed `UU Bot` role, the `Text Channels` / `Voice Channels`
  categories, `#general` and the `General` voice channel are **kept** (never deleted, renamed or recreated). View is
  denied on them for @everyone and Unverified.
- **Roles created:** Unverified, FREE, VIP, Sub-IB, Coach, Admin / Mod, Line: Coach Mike, Line: GFX.
  - Coach goes to both Coach Mike accounts. Admin / Mod goes to Ben.
- **Categories:** START, COMMUNITY, VIP, IB LEADERS, ADMIN, REVIEWS. The full permission matrix is printed by the dry-run.
- **Role order:** after creating roles, setup warns if `UU Bot` sits below any role the bot assigns. It never reorders.
  An admin must drag `UU Bot` above FREE, VIP, Sub-IB, Unverified and all `Line:` roles.
- **Bot permissions:** Manage Roles, Manage Channels, View Channels, Send Messages, Attach Files, Embed Links, Read Message History.

## Secrets and config

- `wrangler.toml` holds only public IDs and `REPLACE_WITH_*` placeholders.
- `DISCORD_PUBLIC_KEY` and `DISCORD_BOT_TOKEN` are set **only** with `wrangler secret put`. For local dev, use `.dev.vars`
  (git-ignored; see `.dev.vars.example`). Never commit or paste them.

## Develop and test

```bash
npm ci
npm run typecheck
npm test                         # Vitest + real SQLite (better-sqlite3) + mocked Discord
npm run build:dry                # wrangler deploy --dry-run
```

## Assumptions (need Design or Ben confirmation)

1. **VIP carry-over (Design signed off, 22 Nov 2026):** an approved VIP proof in the 7-day window (from 00:00
   Asia/Manila, 7 days before the 1st, until 00:00 on the 1st) keeps VIP through that month's reset, including a
   first-time VIP approval in the window. Those members do not get the reset-day DM. Mid-month approvals outside
   the window still reset.
2. **Reset start window:** the reset only starts on Manila days 1–3, so a mid-month deploy never wipes VIP.
3. **Review channel access:** that line's IB, Coach, Admin and the bot. Uplines see escalated cases in their own channel.
4. **New Sub-IB / upline mismatch (Design signed off, 22 Nov 2026):** a new Sub-IB who wasn't a client gets FREE +
   the upline's line tag. A client who becomes a Sub-IB under a different upline is flagged on the card, not blocked.
5. **Unverified:** an HTTP-only bot can't assign roles on join, so @everyone acts as Unverified. The Unverified role is
   removed on approval if present.
6. **Copy (Design signed off, 22 Nov 2026):** the privacy notice, deny presets beyond §10 (wrong upline, unclear
   FREE/VIP, below $50, duplicate, duplicate email, other), and the VIP reminder. Duplicate deny copy is sent only
   after an admin reviews and denies; the application stays pending until then. The screenshot-deletion sentence
   was not added to the modal screenshot Label descriptions: Discord caps those at 100 characters (FREE would be
   105, VIP 118). It stays in the privacy notice in `#start-here`, the `#verify` panel, and at the top of both modals.
7. **Leavers and VIP scope:** the bot can't see leaves. Returning members are detected from D1 on their next
   application. The reset only covers VIPs recorded in D1, not VIP roles added by hand.
8. **Inactive IB lines:** an IB line whose owner leaves stays in the dropdown until an admin sets `active = 0` in D1.
