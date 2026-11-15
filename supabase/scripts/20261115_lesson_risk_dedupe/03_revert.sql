-- 03_revert.sql
-- lesson-risk-dedupe spec (/workspace/gfx/design/trading-system/lesson-risk-dedupe-spec.md), 13 lessons.
-- Restores content + key_takeaways of the 13 rows from the backup table. Only rows that differ from the backup are
-- written (safe to rerun). It restores the whole field, so run it only if no one has edited these lessons since 02_apply.

begin;

update public.lessons l
set content = b.content, key_takeaways = b.key_takeaways, updated_at = now()
from public.lessons_backup_20261115_risk_dedupe b
where l.id = b.id
  and (l.content is distinct from b.content or l.key_takeaways is distinct from b.key_takeaways)
returning l.slug;

commit;

-- After a successful revert and a check with verify.sql, the backup table can be dropped by an operator:
--   drop table public.lessons_backup_20261115_risk_dedupe;
