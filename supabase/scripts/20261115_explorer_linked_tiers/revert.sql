-- Explorer vs Linked tiers: REVERT of supabase/migrations/20261115120000_explorer_linked_tiers.sql (only if needed;
-- needs Jarvis's go like the apply). One transaction. Re-runnable: a second run changes nothing.
--  * public.has_course_access and public.my_payment_info go back to the exact live 15 Nov 2026 bodies (copied verbatim
--    from 20261102140000_courses_payments.sql; md5 5c19835b884faeb0743116d75cb287a9 / 96bbcf2c9095dd4fb99aa6016a2c2081,
--    checked by the verify file's 'revert:' rows). Same grants as before (authenticated only).
--  * Drops the 7 new private functions. Explorers lose Gold Reset again (their progress rows stay, unreadable via RLS).
--  * Drops the 7 audit columns added to private.allowlist_refresh_log (counts/labels of upsert runs are lost; the
--    original columns and rows stay). private.member_allowlist rows added by upserts STAY (that is member data, not
--    schema); the next monthly import_allowlist run reconciles them as usual.
--  * private.import_allowlist(jsonb) and private.match_access_requests() were never changed, so nothing to restore.
-- Afterwards run supabase/verification/20261115120000_explorer_linked_tiers_verify.sql: the 6 always rows ('pre:',
-- 'unchanged:', no prefix) and the 2 'revert:' rows are true (8 rows); every 'apply:' row is false.
begin;

create or replace function public.has_course_access(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    private.owns_open_course(auth.uid(), p_course_id)
    or (public.is_member() and public.prereq_met(p_course_id) and exists (
      select 1 from public.training_courses c
      where c.id = p_course_id and c.status = 'open'
        and (c.price_php = 0 or exists (
          select 1 from public.course_purchases p
          where p.user_id = auth.uid() and p.course_id = c.id and p.status = 'approved')))));
$$;
revoke all on function public.has_course_access(uuid) from public, anon;
grant execute on function public.has_course_access(uuid) to authenticated;

create or replace function public.my_payment_info(p_course_slug text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.training_courses; p public.course_purchases; v_state text;
begin
  if auth.uid() is null then return jsonb_build_object('state', 'not_member'); end if;
  select * into c from public.training_courses where slug = p_course_slug and status = 'open';
  -- S8: a delisted owner still sees 'approved' for a bought course; everything else needs membership.
  if not public.is_member() and not (c.id is not null and private.owns_open_course(auth.uid(), c.id)) then
    return jsonb_build_object('state', 'not_member');
  end if;
  if c.id is null then return jsonb_build_object('state', 'not_found'); end if;
  select * into p from public.course_purchases where user_id = auth.uid() and course_id = c.id;
  v_state := case
    when p.status = 'approved' then 'approved'
    when p.status = 'pending' then 'pending'
    when c.price_php = 0 then 'free'
    when not public.course_content_ready(c.id) then 'coming_soon'
    when not public.prereq_met(c.id) then 'locked'
    when not c.sales_open then 'closed'
    when p.status = 'rejected' then 'rejected'
    else 'open' end;
  return jsonb_build_object('state', v_state, 'course_id', c.id, 'price_php', c.price_php,
    'payment_code', private.payment_code(auth.uid(), c.id), 'purchase_id', p.id,
    'reject_reason', p.reject_reason, 'submitted_at', p.submitted_at);
end $$;
revoke all on function public.my_payment_info(text) from public, anon;
grant execute on function public.my_payment_info(text) to authenticated;

drop function if exists private.import_allowlist_full(jsonb, text, text);
drop function if exists private.upsert_allowlist(jsonb, text, text);
drop function if exists private.activate_consented_members();
drop function if exists private.import_actor(text);
drop function if exists private.clean_source_file(text);
drop function if exists private.join_consented(uuid);
drop function if exists private.explorer_course(uuid);

alter table private.allowlist_refresh_log drop column if exists mode;
alter table private.allowlist_refresh_log drop column if exists source_file;
alter table private.allowlist_refresh_log drop column if exists actor;
alter table private.allowlist_refresh_log drop column if exists updated;
alter table private.allowlist_refresh_log drop column if exists consented_activated;
alter table private.allowlist_refresh_log drop column if exists conflicts;
alter table private.allowlist_refresh_log drop column if exists skipped;

commit;
