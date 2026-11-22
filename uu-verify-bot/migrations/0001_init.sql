-- Universe Unlimited onboarding bot — D1 schema v1 (Cloudflare D1 / SQLite).
-- Separate database. Zero dependency on GFX prod Supabase.
-- Privacy (spec §9/§11): never store balances, deposit amounts, ACCM credentials or client lists.
-- The ACCM IB email is admin-only: never shown in dropdowns or member-facing channels.
-- Re-runnable: every object uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS ib_lines (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT NOT NULL UNIQUE
                    CHECK (length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*'),
  display_name      TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  discord_user_id   TEXT NOT NULL
                    CHECK (length(discord_user_id) BETWEEN 17 AND 20 AND discord_user_id NOT GLOB '*[^0-9]*'),
  -- PRIVATE, admin-only. Stored lowercased.
  accm_ib_email     TEXT CHECK (accm_ib_email IS NULL OR (accm_ib_email = lower(accm_ib_email) AND accm_ib_email LIKE '%_@_%._%')),
  upline_line_id    INTEGER REFERENCES ib_lines(id),
  role_id           TEXT CHECK (role_id IS NULL OR (length(role_id) BETWEEN 17 AND 20 AND role_id NOT GLOB '*[^0-9]*')),
  review_channel_id TEXT CHECK (review_channel_id IS NULL OR (length(review_channel_id) BETWEEN 17 AND 20 AND review_channel_id NOT GLOB '*[^0-9]*')),
  is_seed           INTEGER NOT NULL DEFAULT 0 CHECK (is_seed IN (0, 1)),
  active            INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (upline_line_id IS NULL OR upline_line_id <> id)
);
-- Duplicate ACCM IB email => never a second line (spec §8).
CREATE UNIQUE INDEX IF NOT EXISTS ib_lines_email_uq ON ib_lines (accm_ib_email) WHERE accm_ib_email IS NOT NULL;
-- One active line per Discord user.
CREATE UNIQUE INDEX IF NOT EXISTS ib_lines_active_user_uq ON ib_lines (discord_user_id) WHERE active = 1;
-- Exactly one top of tree (Coach Mike): only one line may have no upline.
CREATE UNIQUE INDEX IF NOT EXISTS ib_lines_single_top_uq ON ib_lines ((upline_line_id IS NULL)) WHERE upline_line_id IS NULL;
CREATE INDEX IF NOT EXISTS ib_lines_active_idx ON ib_lines (active, display_name);

CREATE TABLE IF NOT EXISTS members (
  discord_user_id      TEXT PRIMARY KEY
                       CHECK (length(discord_user_id) BETWEEN 17 AND 20 AND discord_user_id NOT GLOB '*[^0-9]*'),
  display_name         TEXT CHECK (display_name IS NULL OR length(display_name) <= 100),
  accm_user_id         TEXT CHECK (accm_user_id IS NULL OR (length(accm_user_id) = 6 AND accm_user_id NOT GLOB '*[^0-9]*')),
  referring_ib_line_id INTEGER REFERENCES ib_lines(id),
  tier                 TEXT NOT NULL DEFAULT 'unverified' CHECK (tier IN ('unverified', 'free', 'vip')),
  is_sub_ib            INTEGER NOT NULL DEFAULT 0 CHECK (is_sub_ib IN (0, 1)),
  own_ib_line_id       INTEGER REFERENCES ib_lines(id),
  -- 'yes' | 'no' | NULL. NEVER a balance or deposit amount.
  vip_above_min        TEXT CHECK (vip_above_min IS NULL OR vip_above_min IN ('yes', 'no')),
  vip_verified_at      TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS members_accm_idx ON members (accm_user_id);
CREATE INDEX IF NOT EXISTS members_tier_idx ON members (tier, discord_user_id);

CREATE TABLE IF NOT EXISTS applications (
  id                       TEXT PRIMARY KEY CHECK (length(id) BETWEEN 17 AND 20 AND id NOT GLOB '*[^0-9]*'),
  applicant_discord_id     TEXT NOT NULL CHECK (length(applicant_discord_id) BETWEEN 17 AND 20 AND applicant_discord_id NOT GLOB '*[^0-9]*'),
  applicant_display_name   TEXT CHECK (applicant_display_name IS NULL OR length(applicant_display_name) <= 100),
  type                     TEXT NOT NULL CHECK (type IN ('free', 'vip', 'ib')),
  accm_user_id             TEXT CHECK (accm_user_id IS NULL OR (length(accm_user_id) = 6 AND accm_user_id NOT GLOB '*[^0-9]*')),
  -- PRIVATE, admin-only (IB applications only). Lowercased.
  accm_ib_email            TEXT CHECK (accm_ib_email IS NULL OR (accm_ib_email = lower(accm_ib_email) AND accm_ib_email LIKE '%_@_%._%')),
  -- Client: referring IB line. IB: nominated upline line. NULL only for self-selected transfer route.
  target_ib_line_id        INTEGER REFERENCES ib_lines(id),
  current_reviewer_line_id INTEGER REFERENCES ib_lines(id),
  escalation_hops          INTEGER NOT NULL DEFAULT 0 CHECK (escalation_hops >= 0),
  review_channel_id        TEXT,
  review_message_id        TEXT,
  -- Discord CDN URL of the screenshot on the review card. Cleared when the card is deleted.
  screenshot_url           TEXT,
  screenshot_deleted_at    TEXT,
  status                   TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'transferred')),
  decision_reason          TEXT CHECK (decision_reason IS NULL OR length(decision_reason) <= 400),
  decided_by_discord_id    TEXT,
  vip_above_min            TEXT CHECK (vip_above_min IS NULL OR vip_above_min IN ('yes', 'no')),
  -- Comma list: dup_user_id, dup_ib_email, returning, upline_differs, top_alerted, screenshot_missing, member_left.
  flags                    TEXT NOT NULL DEFAULT '',
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  escalate_after_at        TEXT,
  decided_at               TEXT,
  CHECK (type = 'ib' OR accm_user_id IS NOT NULL),
  CHECK (type <> 'ib' OR accm_ib_email IS NOT NULL),
  CHECK (type = 'ib' OR accm_ib_email IS NULL),
  CHECK (type = 'vip' OR vip_above_min IS NULL)
);
-- One pending application per member.
CREATE UNIQUE INDEX IF NOT EXISTS applications_one_pending_uq ON applications (applicant_discord_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS applications_escalate_idx ON applications (status, escalate_after_at);
CREATE INDEX IF NOT EXISTS applications_accm_idx ON applications (accm_user_id);
CREATE INDEX IF NOT EXISTS applications_email_idx ON applications (accm_ib_email);
CREATE INDEX IF NOT EXISTS applications_applicant_idx ON applications (applicant_discord_id, created_at);
CREATE INDEX IF NOT EXISTS applications_card_cleanup_idx ON applications (status, screenshot_deleted_at);

-- Audit trail. No emails, no amounts, no screenshots.
CREATE TABLE IF NOT EXISTS decision_logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id    TEXT,
  action            TEXT NOT NULL CHECK (action IN (
                      'approved', 'denied', 'transferred', 'escalated', 'escalation_top_alert', 'line_created',
                      'vip_reset', 'vip_reminder', 'email_viewed', 'card_delete_failed', 'role_error', 'member_left')),
  actor_discord_id  TEXT,
  target_discord_id TEXT,
  ib_line_id        INTEGER,
  reason_code       TEXT,
  detail            TEXT CHECK (detail IS NULL OR length(detail) <= 400),
  period_key        TEXT CHECK (period_key IS NULL OR period_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  dm_status         TEXT CHECK (dm_status IS NULL OR dm_status IN ('pending', 'sent', 'failed', 'skipped')),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS decision_logs_app_idx ON decision_logs (application_id);
CREATE INDEX IF NOT EXISTS decision_logs_period_idx ON decision_logs (action, period_key, dm_status);
-- One reset row per member per month (idempotent across ticks).
CREATE UNIQUE INDEX IF NOT EXISTS decision_logs_reset_uq ON decision_logs (target_discord_id, period_key) WHERE action = 'vip_reset';

-- Monthly jobs, keyed by Asia/Manila 'YYYY-MM'. A run may span many cron ticks (cursor + phase).
CREATE TABLE IF NOT EXISTS cron_runs (
  job          TEXT NOT NULL CHECK (job IN ('vip_reminder', 'vip_reset')),
  period_key   TEXT NOT NULL CHECK (period_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'skipped')),
  phase        TEXT NOT NULL DEFAULT 'start',
  cursor       TEXT,
  processed    INTEGER NOT NULL DEFAULT 0,
  failed       INTEGER NOT NULL DEFAULT 0,
  started_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at  TEXT,
  PRIMARY KEY (job, period_key)
);

-- Every review card ever posted. Escalation overwrites applications.review_message_id; this table
-- lets cron retry a leftover screenshot in a lower IB channel if the old-card delete failed after a hop.
CREATE TABLE IF NOT EXISTS review_cards (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  channel_id      TEXT NOT NULL
                  CHECK (length(channel_id) BETWEEN 17 AND 20 AND channel_id NOT GLOB '*[^0-9]*'),
  message_id      TEXT NOT NULL
                  CHECK (length(message_id) BETWEEN 17 AND 20 AND message_id NOT GLOB '*[^0-9]*'),
  posted_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS review_cards_msg_uq ON review_cards (channel_id, message_id);
CREATE INDEX IF NOT EXISTS review_cards_pending_idx ON review_cards (deleted_at, application_id);
