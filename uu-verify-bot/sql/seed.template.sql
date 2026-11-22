-- Launch seed: the two launch lines ONLY (spec §12 Phase 1). No launch list of other lines.
-- Do not edit by hand: scripts/setup-server.ts --apply writes seed.generated.sql (git-ignored) with real ids.
-- Placeholders: {{COACH_MIKE_PRIMARY_DISCORD_USER_ID}} (first id in COACH_MIKE_DISCORD_USER_IDS; the other account reviews via config + Coach role) {{COACH_MIKE_IB_EMAIL_OR_NULL}} {{LINE_COACH_MIKE_ROLE_ID}} {{REVIEW_COACH_MIKE_CHANNEL_ID}}
--               {{BEN_DISCORD_USER_ID}} {{LINE_GFX_ROLE_ID}} {{REVIEW_GFX_CHANNEL_ID}}
-- Idempotent: re-running updates ids on the same two rows.
INSERT INTO ib_lines (slug, display_name, discord_user_id, accm_ib_email, upline_line_id, role_id, review_channel_id, is_seed, active)
VALUES ('coach-mike', 'Coach Mike', '{{COACH_MIKE_PRIMARY_DISCORD_USER_ID}}', {{COACH_MIKE_IB_EMAIL_OR_NULL}}, NULL,
        '{{LINE_COACH_MIKE_ROLE_ID}}', '{{REVIEW_COACH_MIKE_CHANNEL_ID}}', 1, 1)
ON CONFLICT (slug) DO UPDATE SET discord_user_id = excluded.discord_user_id, accm_ib_email = excluded.accm_ib_email,
  role_id = excluded.role_id, review_channel_id = excluded.review_channel_id, is_seed = 1, active = 1;
INSERT INTO ib_lines (slug, display_name, discord_user_id, accm_ib_email, upline_line_id, role_id, review_channel_id, is_seed, active)
VALUES ('gfx', 'Ben', '{{BEN_DISCORD_USER_ID}}', 'goldfx.society@gmail.com', (SELECT id FROM ib_lines WHERE slug = 'coach-mike'),
        '{{LINE_GFX_ROLE_ID}}', '{{REVIEW_GFX_CHANNEL_ID}}', 1, 1)
ON CONFLICT (slug) DO UPDATE SET discord_user_id = excluded.discord_user_id, accm_ib_email = excluded.accm_ib_email,
  upline_line_id = excluded.upline_line_id, role_id = excluded.role_id, review_channel_id = excluded.review_channel_id,
  is_seed = 1, active = 1;
