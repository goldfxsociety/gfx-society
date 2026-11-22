-- REVERT for migrations/0001_init.sql. DESTRUCTIVE: drops every bot table and its data.
-- Take a backup first:  npx wrangler d1 export DB --remote --output backups/uu-verify-bot-$(date +%Y%m%d-%H%M).sql
-- Then:                 npx wrangler d1 execute DB --remote --file sql/0001_revert.sql
-- Afterwards sql/0001_verify.sql reports FAIL on every row (tables gone), and the migration can be re-applied.
DROP TABLE IF EXISTS cron_runs;
DROP TABLE IF EXISTS decision_logs;
DROP TABLE IF EXISTS review_cards;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS ib_lines;
-- Let `wrangler d1 migrations apply` run 0001 again (table exists only when migrations were applied via wrangler).
CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
DELETE FROM d1_migrations WHERE name = '0001_init.sql';
