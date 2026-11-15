-- accm-lesson-deposit-edit: VERIFY (read-only SELECT). Run before 02_apply.sql, after it, and after any revert.
-- Spec: /workspace/gfx/design/trading-system/accm-lesson-deposit-edit-spec.md. One row: lesson opening-your-accm-account (graduation),
-- matched by primary key id and checked against the expected level_id + slug.
--   state: BEFORE (live 15 Nov 2026 body = the PR #74 AFTER text, pinned md5) | AFTER (02_apply.sql result, pinned md5)
--          | DRIFTED | MISSING | WRONG_LEVEL_OR_SLUG
--   deposit_terms_n: matches of $50 / GCash / Maya in content + key_takeaways (BEFORE 3, AFTER 0).
--   body_max_n / body_nfa_n: QA's once-rule counters over the body (0 / 0 both before and after; the lesson page
--     footer carries the one "Max 1% risk per trade" and the one "not financial advice").
--   ib_line_ok: "Disclosure: ACCM is GFX's partner broker." still present. risk_step_ok: the 1% step sentence present.
--   updated_at_is_original: true before apply and after a revert; false right after apply.
with e(id, level_id, slug, before_content_md5, after_content_md5, tk_md5, original_updated_at) as (values
    ('0a66d41e-7255-4028-8640-caf4497a4adb'::uuid, 'e42c66c8-abee-47ec-9fa6-d5e67ee7cf34'::uuid, 'opening-your-accm-account', '24802fe754f49fe681c60ea951ae0d6f', '5ca42c8b85241ca36486e0a7a26dff17', 'c525c4d8ceacb8d94199d3df266b048c', '2026-11-15 12:21:35.836247+00'::timestamptz)
),
s as (
  select e.slug, l.id, l.level_id = e.level_id and l.slug = e.slug as level_slug_ok,
    case
      when l.id is null then 'MISSING'
      when l.level_id <> e.level_id or l.slug <> e.slug then 'WRONG_LEVEL_OR_SLUG'
      when md5(l.content) = e.before_content_md5 and md5(l.key_takeaways::text) = e.tk_md5 then 'BEFORE'
      when md5(l.content) = e.after_content_md5 and md5(l.key_takeaways::text) = e.tk_md5 then 'AFTER'
      else 'DRIFTED'
    end as state,
    l.content as content, l.content || coalesce(l.key_takeaways::text, '') as body,
    l.updated_at = e.original_updated_at as updated_at_is_original,
    md5(l.content) as content_md5, md5(l.key_takeaways::text) as key_takeaways_md5
  from e
  left join public.lessons l on l.id = e.id
)
select
  slug, state, level_slug_ok,
  array_length(regexp_split_to_array(body, '\$50|gcash|maya', 'i'), 1) - 1 as deposit_terms_n,
  (length(body) - length(replace(body, 'Max 1% risk per trade', ''))) / 21 as body_max_n,
  array_length(regexp_split_to_array(body, '(not|hindi) financial advice', 'i'), 1) - 1 as body_nfa_n,
  position($s$Disclosure: ACCM is GFX's partner broker.$s$ in content) > 0 as ib_line_ok,
  position($s$Risk no more than 1% of your account on each trade, with a stop-loss on every trade.$s$ in content) > 0 as risk_step_ok,
  position($s$Deposit details are in the app after you log in; check ACCM's site for current terms.$s$ in content) > 0 as has_new_sentence,
  updated_at_is_original, content_md5, key_takeaways_md5
from s;
