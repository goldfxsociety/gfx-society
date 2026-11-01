-- GFX post-launch fix 1, item 5: atomic slot reservation for the 3-codes/hour cap.
-- NOT APPLIED. Apply AFTER 20261102130000_members_gate_email_otp.sql (and after #56's
-- 20261102170000_course_content.sql by version order). Re-runnable.
-- DEPLOY ORDER: apply this migration BEFORE deploying the app commit that calls
-- member_code_reserve / member_code_finish (the old app keeps working on the old functions,
-- which this migration leaves unchanged).
--
-- Race fixed: member_code_allowed only CHECKED the limits and member_code_record inserted the slot
-- after the send, so N parallel requests for one email could all pass (check-then-record).
-- New flow:
--   member_code_reserve(email, ip) -> uuid | null
--     advisory lock per email hash, re-count, and if allowed INSERT the email + IP slot in the same
--     transaction; returns that row's id (the reservation). null = not allowed (never says why).
--   member_code_finish(reservation, email, ip, accepted)
--     accepted              -> keep the reserved row (nothing to do);
--     rejected + reservation -> delete ONLY that row (id + email hash must match) and add a per-IP
--                               reject row;
--     reservation null       -> reject row only (e.g. missing CAPTCHA token: no gate call, no slot).
--   So a request can only ever free its own slot (QA #57 P2-1: no-token requests freed others').
-- The per-IP caps (10 accepted/h, 20 rejects/h) are not locked per IP; they stay best-effort.
-- member_code_allowed / member_code_record (20261102130000) are left as they are for the old app;
-- drop them in a later migration once the new app is live.

alter table private.member_code_requests add column if not exists id uuid not null default gen_random_uuid();
alter table private.member_code_rejects add column if not exists id uuid not null default gen_random_uuid();
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'private.member_code_requests'::regclass and contype = 'p') then
    alter table private.member_code_requests add constraint member_code_requests_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'private.member_code_rejects'::regclass and contype = 'p') then
    alter table private.member_code_rejects add constraint member_code_rejects_pkey primary key (id);
  end if;
end $$;

create or replace function public.member_code_reserve(p_email text, p_ip text)
returns uuid language plpgsql security definer set search_path = private, pg_temp as $$
declare
  v_eh text := private.email_hash(coalesce(p_email, ''));
  v_ih text := private.email_hash('ip:' || coalesce(p_ip, 'unknown'));
  v_id uuid;
begin
  perform public.purge_member_gate_logs();
  if coalesce(btrim(p_email), '') = '' then return null; end if;
  if not exists (select 1 from private.member_allowlist where email_hash = v_eh) then return null; end if;
  -- Serialise per email hash; released at commit, so the count sees every earlier reservation.
  perform pg_advisory_xact_lock(hashtextextended('gfx_member_code:' || v_eh, 0));
  if (select count(*) from private.member_code_requests where email_hash = v_eh and requested_at > now() - interval '1 hour') >= 3
     or (select count(*) from private.member_code_requests where ip_hash = v_ih and requested_at > now() - interval '1 hour') >= 10
     or (select count(*) from private.member_code_rejects where ip_hash = v_ih and rejected_at > now() - interval '1 hour') >= 20 then
    return null;
  end if;
  insert into private.member_code_requests (email_hash, ip_hash) values (v_eh, v_ih) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.member_code_reserve(text, text) from public, anon, authenticated;
grant execute on function public.member_code_reserve(text, text) to service_role;

create or replace function public.member_code_finish(p_reservation uuid, p_email text, p_ip text, p_accepted boolean)
returns void language plpgsql security definer set search_path = private, pg_temp as $$
declare v_ih text := private.email_hash('ip:' || coalesce(p_ip, 'unknown'));
begin
  if p_accepted is true and p_reservation is not null then
    return; -- the reserved row is the used slot
  end if;
  if p_reservation is not null then
    delete from private.member_code_requests
     where id = p_reservation and email_hash = private.email_hash(coalesce(p_email, ''));
  end if;
  insert into private.member_code_rejects (ip_hash) values (v_ih);
end;
$$;
revoke all on function public.member_code_finish(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.member_code_finish(uuid, text, text, boolean) to service_role;

comment on function public.member_code_reserve(text, text) is 'GFX members gate: atomic send gate. Reserves the email + IP slot (advisory lock per email hash) and returns its id; null = not allowed.';
comment on function public.member_code_finish(uuid, text, text, boolean) is 'GFX members gate: after the send. accepted -> keep own reservation; rejected -> delete only own reservation + per-IP reject row; null reservation -> reject row only.';
