-- Read-only check after loading seed.generated.sql (written by scripts/setup-server.ts --apply).
-- Expects exactly the two launch lines: Coach Mike (top) and Ben's GFX line (upline = Coach Mike).
-- One SELECT per check (D1 caps the number of terms in a compound SELECT).
SELECT 'seed_lines' AS check_name,
       CASE WHEN (SELECT count(*) FROM ib_lines WHERE is_seed = 1) = 2 THEN 'ok' ELSE 'FAIL' END AS result;

SELECT 'coach_mike_top' AS check_name,
       CASE WHEN (SELECT count(*) FROM ib_lines WHERE slug = 'coach-mike' AND upline_line_id IS NULL AND active = 1
                  AND role_id IS NOT NULL AND review_channel_id IS NOT NULL) = 1 THEN 'ok' ELSE 'FAIL' END AS result;

SELECT 'gfx_under_coach_mike' AS check_name,
       CASE WHEN (SELECT count(*) FROM ib_lines g JOIN ib_lines c ON c.id = g.upline_line_id
                  WHERE g.slug = 'gfx' AND g.display_name = 'Ben' AND c.slug = 'coach-mike' AND g.active = 1
                  AND g.accm_ib_email = 'goldfx.society@gmail.com'
                  AND g.role_id IS NOT NULL AND g.review_channel_id IS NOT NULL) = 1 THEN 'ok' ELSE 'FAIL' END AS result;
