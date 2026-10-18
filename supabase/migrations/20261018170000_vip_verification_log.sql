-- Discord VIP verification: minimal decision log + request state (NOT APPLIED; needs the founder's apply OK).
-- Used only by the Cloudflare Worker in discord-verify-bot/ with the service-role key (Worker secret).
--
-- Stores Discord snowflake ids (as text), status, timestamps and a reject reason code. Nothing else:
-- no screenshots, image URLs, filenames, usernames, amounts, account numbers or admin notes.
-- RLS is enabled with NO policies for anon/authenticated, so only the service role can read/write.
-- Guarded and re-runnable: every statement is IF NOT EXISTS / idempotent. No pg_cron, no retention job
-- (retention is an open question for the founder; see discord-verify-bot/README.md).

create table if not exists public.discord_vip_requests (
  -- Discord interaction id of the member's submission (unique request id; also used in button custom_ids).
  request_id          text primary key check (request_id ~ '^[0-9]{17,20}$'),
  guild_id            text not null check (guild_id ~ '^[0-9]{17,20}$'),
  member_id           text not null check (member_id ~ '^[0-9]{17,20}$'),
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected', 'expired')),
  admin_id            text check (admin_id is null or admin_id ~ '^[0-9]{17,20}$'),
  reason_code         text check (reason_code is null or reason_code in ('unclear', 'wrong_screen', 'cant_confirm', 'other')),
  -- Outcome flags for the log line, e.g. {dm_failed}, {already_vip}, {member_left}.
  flags               text[] not null default '{}'
                        check (flags <@ array['dm_failed', 'already_vip', 'member_left']::text[]),
  -- Id of the bot's own #vip-approvals message while pending (so it can be deleted). Cleared after the decision.
  approval_message_id text check (approval_message_id is null or approval_message_id ~ '^[0-9]{17,20}$'),
  created_at          timestamptz not null default now(),
  decided_at          timestamptz,
  constraint discord_vip_requests_decided_consistency check (
    (status = 'pending' and decided_at is null and admin_id is null)
    or (status in ('approved', 'rejected') and decided_at is not null and admin_id is not null)
    or (status = 'expired' and decided_at is not null)
  ),
  constraint discord_vip_requests_reason_only_on_reject check (reason_code is null or status = 'rejected')
);

comment on table public.discord_vip_requests is
  'Discord VIP verification state + decision log (ids, status, timestamps, reason code only). Service role only. No images or financial data.';

-- One pending request per member per guild (atomic; concurrent submits get a unique violation).
create unique index if not exists discord_vip_requests_one_pending_per_member
  on public.discord_vip_requests (guild_id, member_id) where status = 'pending';

-- Cooldown / daily-cap / status lookups.
create index if not exists discord_vip_requests_member_created
  on public.discord_vip_requests (guild_id, member_id, created_at desc);

-- Cron expiry of stale pending requests.
create index if not exists discord_vip_requests_pending_created
  on public.discord_vip_requests (created_at) where status = 'pending';

alter table public.discord_vip_requests enable row level security;

revoke all on table public.discord_vip_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.discord_vip_requests to service_role;
