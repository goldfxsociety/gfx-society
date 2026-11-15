-- lesson-risk-dedupe, step 2: BACKUP EXPORT (read-only SELECT; no table, no writes).
-- Run it BEFORE 02_apply.sql and save the single JSON cell to a file, e.g. lessons-backup-20261115-risk-dedupe.json.
-- Expect: rows = 13, all_level_slug_ok = true, all_before = true. Every column 02_apply.sql changes is included
-- (content, key_takeaways, updated_at), with id, level_id and slug. 03_revert.sql does not need this file (it embeds the
-- originals), but keep it as an independent copy of the live rows at apply time.
with e(id, level_id, slug, edit, before_content_md5, before_tk_md5, after_content_md5, after_tk_md5, original_updated_at) as (values
    ('ad3d52a1-544d-47e0-91d9-337503678387'::uuid, 'e7f32ac2-328d-4ec2-b94f-944c6367fe04'::uuid, 'bull-market-vs-bear-market', 'A', '8ffe115d75865b1b85547f8513942011', '8106d2262297454982b96f5de4c8c68b', '6c3099ae81ea317867cfb1c00fcf53aa', '8106d2262297454982b96f5de4c8c68b', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('d7926520-c96b-4d61-bd1e-0078b3b718a8'::uuid, '3f2e8eb3-04f2-49d0-9823-9e40629a5265'::uuid, 'candlestick-anatomy', 'B', '6558bfa684e284247300583f10471488', 'bc34641c550ccdf6613615e6774abcba', '169d174c48a071b6525e8c69598c6b09', 'bc34641c550ccdf6613615e6774abcba', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('bf0e27f5-ab9b-4e63-8f77-8b0a692476e0'::uuid, '3f2e8eb3-04f2-49d0-9823-9e40629a5265'::uuid, 'candlestick-patterns', 'B', 'a5841a999bb1415134e5479bf8087fc6', '6bd36462dfbe76c6eaf16ccbc7c3b4c5', '7591b248c8927757b8de5d456778b8ac', '6bd36462dfbe76c6eaf16ccbc7c3b4c5', '2026-10-18 11:55:48.592883+00'::timestamptz),
    ('3cb8acf1-27ac-42fb-bd4d-95e5b18b00ef'::uuid, '3f2e8eb3-04f2-49d0-9823-9e40629a5265'::uuid, 'cents-account-your-first-real-money-practice', 'BC', '6c93a942562f94538ce5bf6abd5a5126', '7e291402fd0a448b739e304ecc0d0fd5', '0800d99c8caaa6ec97ab8fc4fb9216bf', '54d44d6e329af36fa9d98aa11e015c9f', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('94768e3c-a60b-4fb3-be16-c2e5c5a30132'::uuid, 'e7f32ac2-328d-4ec2-b94f-944c6367fe04'::uuid, 'how-do-traders-make-money', 'A', '4c620553ecc5bcabef29d3c22725b6ae', 'a6b4efb69a6beed146ae791c2f2e5740', 'fa8748388e73f3b155432214e93b8989', 'a6b4efb69a6beed146ae791c2f2e5740', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('0a66d41e-7255-4028-8640-caf4497a4adb'::uuid, 'e42c66c8-abee-47ec-9fa6-d5e67ee7cf34'::uuid, 'opening-your-accm-account', 'D', 'd69d93cae69106738e37531725a745c3', 'c525c4d8ceacb8d94199d3df266b048c', '24802fe754f49fe681c60ea951ae0d6f', 'c525c4d8ceacb8d94199d3df266b048c', '2026-11-01 17:53:57.943701+00'::timestamptz),
    ('a1caf3d9-689a-4696-9443-f9f947a1dd05'::uuid, '3f2e8eb3-04f2-49d0-9823-9e40629a5265'::uuid, 'pips-lots-and-leverage', 'B', '538f7e6634787f34de1aa344dc870f8a', '32041a5a2404aef459c1cf93cd4a5075', 'ce0f41adf5206cc6393d37d84754c8ba', '32041a5a2404aef459c1cf93cd4a5075', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('5b957c8d-5ac5-45ee-bcbf-5bc7ec91d764'::uuid, 'e42c66c8-abee-47ec-9fa6-d5e67ee7cf34'::uuid, 'real-money-and-your-emotions', 'C', 'dde3513b596498c82e7b7d5cedcb063a', 'ee0d8c1c9381e0cec0705ddecfa9eb00', 'dde3513b596498c82e7b7d5cedcb063a', '134e01713ab0ec88676abe467baf4ad9', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('5698278e-2b5c-4706-8032-50cd517df741'::uuid, 'e7f32ac2-328d-4ec2-b94f-944c6367fe04'::uuid, 'stocks-vs-forex-vs-gold', 'A', '8cb39725effbc3cbd20ebbcc5f1d1464', 'd144c1b6f17543bf7ea89d9859d4d84b', '5cbf6bbe43000b48b88f845dca8ade11', 'd144c1b6f17543bf7ea89d9859d4d84b', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('c7eaf0f2-c415-4b9a-97c9-84f0095a721a'::uuid, '3f2e8eb3-04f2-49d0-9823-9e40629a5265'::uuid, 'types-of-orders', 'B', '9fcaa647487977a9fa6fe7045e4505cb', 'f41df115db117c72686cb0a8adbd8adc', 'bea5d07a350e90915af56669d413c0b6', 'f41df115db117c72686cb0a8adbd8adc', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('b123eaf2-b4fa-4ef0-8a07-bdaa190a3286'::uuid, '3f2e8eb3-04f2-49d0-9823-9e40629a5265'::uuid, 'what-is-a-broker', 'B', '401f93b366a1a0f04eaf31313413e7be', '723e3da319ab745cc352115d4ca13f24', '32fc035aacfd9b1503e8fe0c17940083', '723e3da319ab745cc352115d4ca13f24', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('3ea5a6f7-d454-4734-8a8a-af15f8c0adca'::uuid, 'e7f32ac2-328d-4ec2-b94f-944c6367fe04'::uuid, 'what-is-a-spread', 'A', 'f4e8a2adf44bd54ad63895591a62053b', '2b187c5019300804d7d626db2875d327', '22b134661c145adf0a403a959300ae76', '2b187c5019300804d7d626db2875d327', '2026-10-18 05:44:40.688404+00'::timestamptz),
    ('680c3ddf-a5e5-459d-bdf3-e8f06251e1de'::uuid, 'e7f32ac2-328d-4ec2-b94f-944c6367fe04'::uuid, 'what-is-the-financial-market', 'A', 'b060d7825da63d98e7c78d95ea105616', '725b232d36d43db78f0bbce3ab9cea77', 'a7f3dbd1663e76def932496761b6dfa9', '725b232d36d43db78f0bbce3ab9cea77', '2026-10-18 05:44:40.688404+00'::timestamptz)
)
select
  count(l.id) as rows,
  bool_and(l.level_id = e.level_id and l.slug = e.slug) as all_level_slug_ok,
  bool_and(md5(l.content) = e.before_content_md5 and md5(l.key_takeaways::text) = e.before_tk_md5) as all_before,
  jsonb_pretty(jsonb_agg(jsonb_build_object(
    'id', l.id, 'level_id', l.level_id, 'slug', l.slug,
    'content', l.content, 'key_takeaways', l.key_takeaways, 'updated_at', l.updated_at,
    'content_md5', md5(l.content), 'key_takeaways_md5', md5(l.key_takeaways::text)
  ) order by l.slug)) as lessons_backup_json
from e
left join public.lessons l on l.id = e.id;
