-- accm-lesson-deposit-edit, step 2: BACKUP EXPORT (read-only SELECT; no table, no writes).
-- Run it BEFORE 02_apply.sql and save the single JSON cell to a file, e.g. lesson-backup-20261115-accm-deposit-edit.json.
-- Expect: rows = 1, level_slug_ok = true, is_before = true. Every column 02_apply.sql changes is included (content,
-- updated_at), plus key_takeaways, id, level_id, slug and md5s. 03_revert.sql does not need this file (it embeds the
-- original), but keep it as an independent copy of the live row at apply time.
with e(id, level_id, slug, before_content_md5, after_content_md5, tk_md5, original_updated_at) as (values
    ('0a66d41e-7255-4028-8640-caf4497a4adb'::uuid, 'e42c66c8-abee-47ec-9fa6-d5e67ee7cf34'::uuid, 'opening-your-accm-account', '24802fe754f49fe681c60ea951ae0d6f', '5ca42c8b85241ca36486e0a7a26dff17', 'c525c4d8ceacb8d94199d3df266b048c', '2026-11-15 12:21:35.836247+00'::timestamptz)
)
select
  count(l.id) as rows,
  bool_and(l.level_id = e.level_id and l.slug = e.slug) as level_slug_ok,
  bool_and(md5(l.content) = e.before_content_md5 and md5(l.key_takeaways::text) = e.tk_md5) as is_before,
  jsonb_pretty(jsonb_agg(jsonb_build_object(
    'id', l.id, 'level_id', l.level_id, 'slug', l.slug,
    'content', l.content, 'key_takeaways', l.key_takeaways, 'updated_at', l.updated_at,
    'content_md5', md5(l.content), 'key_takeaways_md5', md5(l.key_takeaways::text)
  ))) as lesson_backup_json
from e
left join public.lessons l on l.id = e.id;
