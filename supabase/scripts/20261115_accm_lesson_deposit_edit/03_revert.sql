-- accm-lesson-deposit-edit, ROLLBACK (only if needed): restores the exact original content and updated_at of
-- opening-your-accm-account, by primary key id. Self-contained: the original body is embedded below as a dollar-quoted literal
-- (tag $alde_orig_20261115$), copied byte for byte from a read-only prod SELECT on 15 Nov 2026 (md5 24802fe754f49fe681c60ea951ae0d6f,
-- which is the PR #74 AFTER text). key_takeaways is never changed by this edit; it is only md5-checked.
-- One transaction, all or nothing:
--   * locks the row, then aborts unless the id exists with the expected level_id + slug;
--   * already back to the original: NOTICE, changes nothing (safe rerun);
--   * otherwise aborts unless it is exactly in the AFTER state of 02_apply.sql (md5), so a later edit is never clobbered;
--   * after the UPDATE, aborts (rolls back) unless the row matches the original md5 AND the original updated_at.
-- No new table, schema, RLS or grant.
begin;

do $alde_revert$
declare
  v_id     constant uuid := '0a66d41e-7255-4028-8640-caf4497a4adb';
  v_level  constant uuid := 'e42c66c8-abee-47ec-9fa6-d5e67ee7cf34';
  v_slug   constant text := 'opening-your-accm-account';
  v_before constant text := '24802fe754f49fe681c60ea951ae0d6f';  -- live body, 15 Nov 2026 read-only prod SELECT (= PR #74 AFTER)
  v_after  constant text := '5ca42c8b85241ca36486e0a7a26dff17';
  v_tk     constant text := 'c525c4d8ceacb8d94199d3df266b048c';  -- key_takeaways::text, never changed here
  v_upd    constant timestamptz := '2026-11-15 12:21:35.836247+00'::timestamptz;
  orig     constant text := $alde_orig_20261115$This lesson shows the general steps to get started with ACCM, the broker used in the Academy's examples.

Disclosure: ACCM is GFX's partner broker.

Steps to get started:
1. Check the broker's licence for your country and the legal entity you would sign up with, on the regulator's own public register.
2. If you decide to trade, register a cents account (real money; balance shown in cents, very small lot sizes) through GFX's IB link, complete KYC (ID + selfie), and start small with money you can afford to lose. Minimum deposit: $50 (as of Oct 2026), via GCash, Maya, or other e-wallets; check ACCM's site for current terms. Risk no more than 1% of your account on each trade, with a stop-loss on every trade.
3. Optional: if you've never used MT5, you can open a free demo inside the MT5 app (no ACCM registration needed) just to learn the buttons before your first cents trade. It isn't required.

Sa Taglish: I-check muna ang licence ng broker para sa bansa mo. Kung magte-trade ka, cents account: real money pero maliit lang, pera lang na kaya mong mawala, max 1% risk, laging may stop-loss. Optional ang MT5 demo, para lang sa buttons.$alde_orig_20261115$;
  st text; n_upd int;
begin
  if md5(orig) <> v_before then raise exception 'accm-lesson-deposit-edit revert ABORTED: embedded original does not hash to %', v_before; end if;
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
    raise exception 'accm-lesson-deposit-edit revert ABORTED: expected id % with the expected level_id + slug, found %', v_id, st;
  end if;
  if st = 'BEFORE' then
    raise notice 'accm-lesson-deposit-edit revert: the row already holds the original text. Nothing changed.';
    return;
  end if;
  if st <> 'AFTER' then
    raise exception 'accm-lesson-deposit-edit revert ABORTED, nothing changed: expected the exact AFTER state, found % for %', st, v_slug;
  end if;

  update public.lessons l
     set content = orig, updated_at = v_upd
   where l.id = v_id and l.level_id = v_level and l.slug = v_slug
     and md5(l.content) = v_after and md5(l.key_takeaways::text) = v_tk;
  get diagnostics n_upd = row_count;
  if n_upd <> 1 then raise exception 'accm-lesson-deposit-edit revert ABORTED (rolled back): updated % rows, expected 1', n_upd; end if;

  if not exists (select 1 from public.lessons l where l.id = v_id and md5(l.content) = v_before
                   and md5(l.key_takeaways::text) = v_tk and l.updated_at = v_upd) then
    raise exception 'accm-lesson-deposit-edit revert ABORTED (rolled back): the row does not match the original md5 + updated_at';
  end if;
  raise notice 'accm-lesson-deposit-edit revert: 1 row restored (content, updated_at) and verified against the original md5 + updated_at.';
end
$alde_revert$;

commit;
