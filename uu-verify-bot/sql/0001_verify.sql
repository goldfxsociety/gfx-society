-- Read-only check for migrations/0001_init.sql. Every row must say result = 'ok'.
-- One SELECT per check (D1 caps the number of terms in a compound SELECT).
--   npx wrangler d1 execute DB --remote --file sql/0001_verify.sql
SELECT 'tables' AS check_name,
       CASE WHEN (SELECT count(*) FROM sqlite_master WHERE type = 'table'
                  AND name IN ('ib_lines', 'members', 'applications', 'decision_logs', 'cron_runs')) = 5
            THEN 'ok' ELSE 'FAIL' END AS result;

SELECT 'indexes' AS check_name,
       CASE WHEN (SELECT count(*) FROM sqlite_master WHERE type = 'index' AND name IN (
                  'ib_lines_email_uq', 'ib_lines_active_user_uq', 'ib_lines_single_top_uq', 'ib_lines_active_idx',
                  'members_accm_idx', 'members_tier_idx',
                  'applications_one_pending_uq', 'applications_escalate_idx', 'applications_accm_idx',
                  'applications_email_idx', 'applications_applicant_idx', 'applications_card_cleanup_idx',
                  'decision_logs_app_idx', 'decision_logs_period_idx', 'decision_logs_reset_uq')) = 15
            THEN 'ok' ELSE 'FAIL' END AS result;

-- Privacy: no amount / balance / deposit / password / token columns anywhere (and no email in the audit log).
SELECT 'no_amount_columns' AS check_name,
       CASE WHEN (SELECT count(*) FROM pragma_table_info('members') WHERE name GLOB '*balance*' OR name GLOB '*amount*' OR name GLOB '*deposit*' OR name GLOB '*password*' OR name GLOB '*token*')
               + (SELECT count(*) FROM pragma_table_info('applications') WHERE name GLOB '*balance*' OR name GLOB '*amount*' OR name GLOB '*deposit*' OR name GLOB '*password*' OR name GLOB '*token*')
               + (SELECT count(*) FROM pragma_table_info('ib_lines') WHERE name GLOB '*balance*' OR name GLOB '*amount*' OR name GLOB '*deposit*' OR name GLOB '*password*' OR name GLOB '*token*')
               + (SELECT count(*) FROM pragma_table_info('decision_logs') WHERE name GLOB '*balance*' OR name GLOB '*amount*' OR name GLOB '*deposit*' OR name GLOB '*email*') = 0
            THEN 'ok' ELSE 'FAIL' END AS result;

SELECT 'members_columns' AS check_name,
       CASE WHEN (SELECT count(*) FROM pragma_table_info('members') WHERE name IN (
                  'discord_user_id', 'display_name', 'accm_user_id', 'referring_ib_line_id', 'tier', 'is_sub_ib',
                  'own_ib_line_id', 'vip_above_min', 'vip_verified_at', 'created_at', 'updated_at')) = 11
            THEN 'ok' ELSE 'FAIL' END AS result;

SELECT 'ib_lines_columns' AS check_name,
       CASE WHEN (SELECT count(*) FROM pragma_table_info('ib_lines') WHERE name IN (
                  'id', 'slug', 'display_name', 'discord_user_id', 'accm_ib_email', 'upline_line_id', 'role_id',
                  'review_channel_id', 'is_seed', 'active', 'created_at')) = 11
            THEN 'ok' ELSE 'FAIL' END AS result;

SELECT 'applications_columns' AS check_name,
       CASE WHEN (SELECT count(*) FROM pragma_table_info('applications') WHERE name IN (
                  'id', 'applicant_discord_id', 'applicant_display_name', 'type', 'accm_user_id', 'accm_ib_email',
                  'target_ib_line_id', 'current_reviewer_line_id', 'escalation_hops', 'review_channel_id',
                  'review_message_id', 'screenshot_url', 'screenshot_deleted_at', 'status', 'decision_reason',
                  'decided_by_discord_id', 'vip_above_min', 'flags', 'created_at', 'escalate_after_at', 'decided_at')) = 21
            THEN 'ok' ELSE 'FAIL' END AS result;

SELECT 'foreign_keys_clean' AS check_name,
       CASE WHEN (SELECT count(*) FROM pragma_foreign_key_check) = 0 THEN 'ok' ELSE 'FAIL' END AS result;
