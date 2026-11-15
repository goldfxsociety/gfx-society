-- accm-lesson-deposit-edit, step 3: APPLY. Writes public.lessons, ONE row (opening-your-accm-account, by primary key id), field
-- content only (+ updated_at). Spec: /workspace/gfx/design/trading-system/accm-lesson-deposit-edit-spec.md (1 replacement).
-- Ship AFTER PR #75 merges (the in-app deposit block must exist first). Run once in the SQL editor.
-- One transaction, all or nothing:
--   * locks the row (SELECT ... FOR UPDATE), then aborts (RAISE EXCEPTION) unless the id exists with the expected
--     level_id + slug;
--   * already in the pinned AFTER state (md5 of content + key_takeaways::text): NOTICE, changes nothing (safe rerun);
--   * otherwise aborts unless it is exactly in the pinned BEFORE state (md5 from the 15 Nov 2026 read-only prod SELECT)
--     and the old sentence occurs exactly once;
--   * after the UPDATE, aborts (rolls back) unless the row hashes to the expected AFTER md5.
-- No new table, schema, RLS or grant. Keep the 01_backup.sql output first; 03_revert.sql restores the exact original.
begin;

do $alde_apply$
declare
  v_id     constant uuid := '0a66d41e-7255-4028-8640-caf4497a4adb';
  v_level  constant uuid := 'e42c66c8-abee-47ec-9fa6-d5e67ee7cf34';
  v_slug   constant text := 'opening-your-accm-account';
  v_before constant text := '24802fe754f49fe681c60ea951ae0d6f';  -- live body, 15 Nov 2026 read-only prod SELECT (= PR #74 AFTER)
  v_after  constant text := '5ca42c8b85241ca36486e0a7a26dff17';
  v_tk     constant text := 'c525c4d8ceacb8d94199d3df266b048c';  -- key_takeaways::text, never changed here
  old_s    constant text := $s$Minimum deposit: $50 (as of Oct 2026), via GCash, Maya, or other e-wallets; check ACCM's site for current terms.$s$;
  new_s    constant text := $s$Deposit details are in the app after you log in; check ACCM's site for current terms.$s$;
  st text; n_old int; n_upd int;
begin
  perform 1 from public.lessons l where l.id = v_id for update;
  select (
    select case
        when l.id is null then 'MISSING'
        when l.level_id <> v_level or l.slug <> v_slug then 'WRONG_LEVEL_OR_SLUG'
        when md5(l.content) = v_before and md5(l.key_takeaways::text) = v_tk then 'BEFORE'
        when md5(l.content) = v_after and md5(l.key_takeaways::text) = v_tk then 'AFTER'
        else 'DRIFTED'
      end
      from (select 1) one left join public.lessons l on l.id = v_id
  ) into st;

  if st in ('MISSING', 'WRONG_LEVEL_OR_SLUG') then
    raise exception 'accm-lesson-deposit-edit apply ABORTED: expected id % with the expected level_id + slug, found %', v_id, st;
  end if;
  if st = 'AFTER' then
    raise notice 'accm-lesson-deposit-edit apply: the row is already in the AFTER state. Nothing changed.';
    return;
  end if;
  if st <> 'BEFORE' then
    raise exception 'accm-lesson-deposit-edit apply ABORTED, nothing changed: expected the pinned BEFORE state, found % for %', st, v_slug;
  end if;
  select (length(l.content) - length(replace(l.content, old_s, ''))) / length(old_s) into n_old from public.lessons l where l.id = v_id;
  if n_old <> 1 then raise exception 'accm-lesson-deposit-edit apply ABORTED: old sentence found % times, expected 1', n_old; end if;

  update public.lessons l
     set content = replace(l.content, old_s, new_s), updated_at = now()
   where l.id = v_id and l.level_id = v_level and l.slug = v_slug
     and md5(l.content) = v_before and md5(l.key_takeaways::text) = v_tk;
  get diagnostics n_upd = row_count;
  if n_upd <> 1 then raise exception 'accm-lesson-deposit-edit apply ABORTED (rolled back): updated % rows, expected 1', n_upd; end if;

  if not exists (select 1 from public.lessons l where l.id = v_id and md5(l.content) = v_after and md5(l.key_takeaways::text) = v_tk) then
    raise exception 'accm-lesson-deposit-edit apply ABORTED (rolled back): the row does not match the expected AFTER md5';
  end if;
  raise notice 'accm-lesson-deposit-edit apply: 1 row updated and verified against the AFTER md5.';
end
$alde_apply$;

commit;
