-- lesson-risk-dedupe, step 3: APPLY. Writes public.lessons (13 rows, by primary key id). Run once in the SQL editor.
-- One transaction, all or nothing:
--   * aborts (RAISE EXCEPTION) unless all 13 ids exist with the expected level_id + slug;
--   * all 13 already in the pinned AFTER state (md5 of content + key_takeaways::text): NOTICE, changes nothing (safe rerun);
--   * otherwise aborts unless all 13 are in the pinned BEFORE state (md5 from the 15 Nov 2026 read-only prod SELECT);
--   * after the UPDATE, aborts (rolls back) unless all 13 rows hash to the expected AFTER md5s.
-- No new table, schema, RLS or grant. Keep the 01_backup.sql output first; 03_revert.sql restores the exact originals.
begin;

do $lrd_apply$
declare
  m constant jsonb := $m$[
    {"id": "ad3d52a1-544d-47e0-91d9-337503678387", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "bull-market-vs-bear-market", "edit": "A", "before_content_md5": "8ffe115d75865b1b85547f8513942011", "before_tk_md5": "8106d2262297454982b96f5de4c8c68b", "after_content_md5": "6c3099ae81ea317867cfb1c00fcf53aa", "after_tk_md5": "8106d2262297454982b96f5de4c8c68b"},
    {"id": "d7926520-c96b-4d61-bd1e-0078b3b718a8", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "candlestick-anatomy", "edit": "B", "before_content_md5": "6558bfa684e284247300583f10471488", "before_tk_md5": "bc34641c550ccdf6613615e6774abcba", "after_content_md5": "169d174c48a071b6525e8c69598c6b09", "after_tk_md5": "bc34641c550ccdf6613615e6774abcba"},
    {"id": "bf0e27f5-ab9b-4e63-8f77-8b0a692476e0", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "candlestick-patterns", "edit": "B", "before_content_md5": "a5841a999bb1415134e5479bf8087fc6", "before_tk_md5": "6bd36462dfbe76c6eaf16ccbc7c3b4c5", "after_content_md5": "7591b248c8927757b8de5d456778b8ac", "after_tk_md5": "6bd36462dfbe76c6eaf16ccbc7c3b4c5"},
    {"id": "3cb8acf1-27ac-42fb-bd4d-95e5b18b00ef", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "cents-account-your-first-real-money-practice", "edit": "BC", "before_content_md5": "6c93a942562f94538ce5bf6abd5a5126", "before_tk_md5": "7e291402fd0a448b739e304ecc0d0fd5", "after_content_md5": "0800d99c8caaa6ec97ab8fc4fb9216bf", "after_tk_md5": "54d44d6e329af36fa9d98aa11e015c9f"},
    {"id": "94768e3c-a60b-4fb3-be16-c2e5c5a30132", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "how-do-traders-make-money", "edit": "A", "before_content_md5": "4c620553ecc5bcabef29d3c22725b6ae", "before_tk_md5": "a6b4efb69a6beed146ae791c2f2e5740", "after_content_md5": "fa8748388e73f3b155432214e93b8989", "after_tk_md5": "a6b4efb69a6beed146ae791c2f2e5740"},
    {"id": "0a66d41e-7255-4028-8640-caf4497a4adb", "level_id": "e42c66c8-abee-47ec-9fa6-d5e67ee7cf34", "slug": "opening-your-accm-account", "edit": "D", "before_content_md5": "d69d93cae69106738e37531725a745c3", "before_tk_md5": "c525c4d8ceacb8d94199d3df266b048c", "after_content_md5": "24802fe754f49fe681c60ea951ae0d6f", "after_tk_md5": "c525c4d8ceacb8d94199d3df266b048c"},
    {"id": "a1caf3d9-689a-4696-9443-f9f947a1dd05", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "pips-lots-and-leverage", "edit": "B", "before_content_md5": "538f7e6634787f34de1aa344dc870f8a", "before_tk_md5": "32041a5a2404aef459c1cf93cd4a5075", "after_content_md5": "ce0f41adf5206cc6393d37d84754c8ba", "after_tk_md5": "32041a5a2404aef459c1cf93cd4a5075"},
    {"id": "5b957c8d-5ac5-45ee-bcbf-5bc7ec91d764", "level_id": "e42c66c8-abee-47ec-9fa6-d5e67ee7cf34", "slug": "real-money-and-your-emotions", "edit": "C", "before_content_md5": "dde3513b596498c82e7b7d5cedcb063a", "before_tk_md5": "ee0d8c1c9381e0cec0705ddecfa9eb00", "after_content_md5": "dde3513b596498c82e7b7d5cedcb063a", "after_tk_md5": "134e01713ab0ec88676abe467baf4ad9"},
    {"id": "5698278e-2b5c-4706-8032-50cd517df741", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "stocks-vs-forex-vs-gold", "edit": "A", "before_content_md5": "8cb39725effbc3cbd20ebbcc5f1d1464", "before_tk_md5": "d144c1b6f17543bf7ea89d9859d4d84b", "after_content_md5": "5cbf6bbe43000b48b88f845dca8ade11", "after_tk_md5": "d144c1b6f17543bf7ea89d9859d4d84b"},
    {"id": "c7eaf0f2-c415-4b9a-97c9-84f0095a721a", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "types-of-orders", "edit": "B", "before_content_md5": "9fcaa647487977a9fa6fe7045e4505cb", "before_tk_md5": "f41df115db117c72686cb0a8adbd8adc", "after_content_md5": "bea5d07a350e90915af56669d413c0b6", "after_tk_md5": "f41df115db117c72686cb0a8adbd8adc"},
    {"id": "b123eaf2-b4fa-4ef0-8a07-bdaa190a3286", "level_id": "3f2e8eb3-04f2-49d0-9823-9e40629a5265", "slug": "what-is-a-broker", "edit": "B", "before_content_md5": "401f93b366a1a0f04eaf31313413e7be", "before_tk_md5": "723e3da319ab745cc352115d4ca13f24", "after_content_md5": "32fc035aacfd9b1503e8fe0c17940083", "after_tk_md5": "723e3da319ab745cc352115d4ca13f24"},
    {"id": "3ea5a6f7-d454-4734-8a8a-af15f8c0adca", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "what-is-a-spread", "edit": "A", "before_content_md5": "f4e8a2adf44bd54ad63895591a62053b", "before_tk_md5": "2b187c5019300804d7d626db2875d327", "after_content_md5": "22b134661c145adf0a403a959300ae76", "after_tk_md5": "2b187c5019300804d7d626db2875d327"},
    {"id": "680c3ddf-a5e5-459d-bdf3-e8f06251e1de", "level_id": "e7f32ac2-328d-4ec2-b94f-944c6367fe04", "slug": "what-is-the-financial-market", "edit": "A", "before_content_md5": "b060d7825da63d98e7c78d95ea105616", "before_tk_md5": "725b232d36d43db78f0bbce3ab9cea77", "after_content_md5": "a7f3dbd1663e76def932496761b6dfa9", "after_tk_md5": "725b232d36d43db78f0bbce3ab9cea77"}
  ]$m$;
  closing  constant text := $s$Trading involves real risk of loss. GFX provides education only, not financial advice. Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$s$;
  short    constant text := $s$Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.$s$;
  disc_old constant text := $s$Disclosure: ACCM is GFX's partner broker. Education only, not financial advice.$s$;
  disc_new constant text := $s$Disclosure: ACCM is GFX's partner broker.$s$;
  max_old  constant text := $s$Max 1% risk per trade, stop-loss on every trade.$s$;
  max_new  constant text := $s$Risk no more than 1% of your account on each trade, with a stop-loss on every trade.$s$;
  n_ok int; n_before int; n_after int; n_upd int; states text;
begin
  if jsonb_array_length(m) <> 13 then raise exception 'lesson-risk-dedupe apply ABORTED: manifest has % rows, expected 13', jsonb_array_length(m); end if;

  -- Lock the 13 target rows (by id) for the rest of the transaction.
  perform 1 from public.lessons l where l.id in (select x.id from jsonb_to_recordset(m) as x(id uuid, level_id uuid, slug text, edit text, before_content_md5 text, before_tk_md5 text, after_content_md5 text, after_tk_md5 text)) for update;

  select count(*) filter (where s.state in ('BEFORE', 'AFTER', 'DRIFTED')),
         count(*) filter (where s.state = 'BEFORE'),
         count(*) filter (where s.state = 'AFTER'),
         string_agg(s.slug || '=' || s.state, ', ' order by s.slug)
    into n_ok, n_before, n_after, states
  from (
    select e.slug, case
        when l.id is null then 'MISSING'
        when l.level_id <> e.level_id or l.slug <> e.slug then 'WRONG_LEVEL_OR_SLUG'
        when md5(l.content) = e.before_content_md5 and md5(l.key_takeaways::text) = e.before_tk_md5 then 'BEFORE'
        when md5(l.content) = e.after_content_md5 and md5(l.key_takeaways::text) = e.after_tk_md5 then 'AFTER'
        else 'DRIFTED'
      end as state
    from jsonb_to_recordset(m) as e(id uuid, level_id uuid, slug text, edit text, before_content_md5 text, before_tk_md5 text, after_content_md5 text, after_tk_md5 text)
    left join public.lessons l on l.id = e.id
  ) s;

  if n_ok <> 13 then
    raise exception 'lesson-risk-dedupe apply ABORTED: expected 13 rows by id with the expected level_id + slug, found %. States: %', n_ok, states;
  end if;
  if n_after = 13 then
    raise notice 'lesson-risk-dedupe apply: all 13 rows already in the AFTER state. Nothing changed.';
    return;
  end if;
  if n_before <> 13 then
    raise exception 'lesson-risk-dedupe apply ABORTED, nothing changed: expected all 13 rows in the pinned BEFORE state, found before=% after=% (mixed or drifted). States: %', n_before, n_after, states;
  end if;

  update public.lessons l
  set content = case e.edit
        -- A: drop the SHORT line before a "## " heading, then the trailing CLOSING paragraph
        when 'A' then (select case when right(x.c, length(E'\n\n' || closing)) = E'\n\n' || closing
                                   then left(x.c, length(x.c) - length(E'\n\n' || closing)) else x.c end
                         from (select replace(l.content, E'\n' || short || E'\n\n## ', E'\n\n## ') as c) x)
        -- B (+C): drop the trailing CLOSING paragraph
        when 'B' then left(l.content, length(l.content) - length(E'\n\n' || closing))
        when 'BC' then left(l.content, length(l.content) - length(E'\n\n' || closing))
        -- D: drop the NFA after the IB disclosure; rephrase the "Max 1% risk per trade" step
        when 'D' then replace(replace(l.content, disc_old, disc_new), max_old, max_new)
        else l.content end,
      -- C: drop the last takeaway (exactly SHORT)
      key_takeaways = case when e.edit in ('C', 'BC') and l.key_takeaways ->> -1 = short then l.key_takeaways - (-1) else l.key_takeaways end,
      updated_at = now()
  from jsonb_to_recordset(m) as e(id uuid, level_id uuid, slug text, edit text, before_content_md5 text, before_tk_md5 text, after_content_md5 text, after_tk_md5 text)
  where l.id = e.id
    and l.level_id = e.level_id and l.slug = e.slug
    and md5(l.content) = e.before_content_md5 and md5(l.key_takeaways::text) = e.before_tk_md5;
  get diagnostics n_upd = row_count;
  if n_upd <> 13 then raise exception 'lesson-risk-dedupe apply ABORTED (rolled back): updated % rows, expected 13', n_upd; end if;

  select count(*) into n_after
  from jsonb_to_recordset(m) as e(id uuid, level_id uuid, slug text, edit text, before_content_md5 text, before_tk_md5 text, after_content_md5 text, after_tk_md5 text)
  join public.lessons l on l.id = e.id
  where md5(l.content) = e.after_content_md5 and md5(l.key_takeaways::text) = e.after_tk_md5;
  if n_after <> 13 then raise exception 'lesson-risk-dedupe apply ABORTED (rolled back): only % of 13 rows match the expected AFTER md5', n_after; end if;

  raise notice 'lesson-risk-dedupe apply: 13 rows updated and verified against the AFTER md5s.';
end
$lrd_apply$;

commit;
