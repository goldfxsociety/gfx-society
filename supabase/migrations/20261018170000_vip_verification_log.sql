-- Discord VIP verification: minimal decision log + request state (NOT APPLIED; needs the founder's apply OK).
-- Used only by the Cloudflare Worker in discord-verify-bot/ with the service-role key (Worker secret).
--
-- Stores Discord snowflake ids (as text), status, timestamps and a reject reason code. Nothing else:
-- no screenshots, image URLs, filenames, usernames, amounts, account numbers or admin notes.
-- RLS is enabled with NO policies, and ALL privileges are explicitly revoked from PUBLIC, anon and
-- authenticated, so only the service role can read/write.
-- Retention (decided default): decided rows are deleted 12 months after decided_at by the Worker's
-- hourly cron (not pg_cron). @VIP is permanent: nothing here or in the bot removes roles.
-- Guarded and re-runnable: every statement is IF NOT EXISTS / idempotent.

create table if not exists public.discord_vip_requests (
  -- Discord interaction id of the member's submission (unique request id; also used in button custom_ids).
  request_id          text primary key check (request_id ~ '^[0-9]{17,20}$'),
  guild_id            text not null check (guild_id ~ '^[0-9]{17,20}$'),
  member_id           text not null check (member_id ~ '^[0-9]{17,20}$'),
  -- needs_info = admin asked for more info; the request is closed and the member may resubmit right away.
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected', 'needs_info', 'expired')),
  admin_id            text check (admin_id is null or admin_id ~ '^[0-9]{17,20}$'),
  reason_code         text check (reason_code is null or reason_code in
                        ('unclear', 'wrong_screen', 'not_accm', 'too_old', 'cant_confirm', 'other')),
  -- Outcome flags for the log line, e.g. {dm_failed}, {already_vip}, {member_left}.
  flags               text[] not null default '{}'
                        check (flags <@ array['dm_failed', 'already_vip', 'member_left']::text[]),
  -- Id of the bot's own #vip-approvals message (so it can be deleted). Cleared once deleted (or already gone);
  -- kept after the decision if the delete failed, so the hourly cron retries it.
  approval_message_id text check (approval_message_id is null or approval_message_id ~ '^[0-9]{17,20}$'),
  -- Id of the bot's one-line #vip-log mirror message (so the 12-month purge can delete it too).
  log_message_id      text check (log_message_id is null or log_message_id ~ '^[0-9]{17,20}$'),
  -- When the one-time "delete this card manually" alert was posted to #vip-log (card delete failed).
  card_alert_at       timestamptz,
  created_at          timestamptz not null default now(),
  decided_at          timestamptz,
  constraint discord_vip_requests_decided_consistency check (
    (status = 'pending' and decided_at is null and admin_id is null)
    or (status in ('approved', 'rejected', 'needs_info') and decided_at is not null and admin_id is not null)
    or (status = 'expired' and decided_at is not null)
  ),
  constraint discord_vip_requests_reason_only_on_reject check (reason_code is null or status = 'rejected')
);

comment on table public.discord_vip_requests is
  'Discord VIP verification state + decision log (ids, status, timestamps, reason code only). Service role only. No images or financial data. Decided rows deleted after 12 months.';

-- One pending request per member per guild (atomic; concurrent submits get a unique violation).
create unique index if not exists discord_vip_requests_one_pending_per_member
  on public.discord_vip_requests (guild_id, member_id) where status = 'pending';

-- Cooldown / daily-cap / status lookups.
create index if not exists discord_vip_requests_member_created
  on public.discord_vip_requests (guild_id, member_id, created_at desc);

-- Cron expiry of stale pending requests.
create index if not exists discord_vip_requests_pending_created
  on public.discord_vip_requests (created_at) where status = 'pending';

-- 12-month retention purge.
create index if not exists discord_vip_requests_decided_at
  on public.discord_vip_requests (decided_at) where decided_at is not null;

-- Hourly retry of approval cards (screenshots) left behind on decided rows.
create index if not exists discord_vip_requests_leftover_cards
  on public.discord_vip_requests (decided_at) where approval_message_id is not null and status <> 'pending';

alter table public.discord_vip_requests enable row level security;

-- Explicit lock-down of this table only (no default-privileges changes).
revoke all on table public.discord_vip_requests from public;
revoke all on table public.discord_vip_requests from anon;
revoke all on table public.discord_vip_requests from authenticated;
grant select, insert, update, delete on table public.discord_vip_requests to service_role;
