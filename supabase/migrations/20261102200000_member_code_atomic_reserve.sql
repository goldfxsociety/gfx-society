-- GFX post-launch fix 1, item 5: atomic slot reservation for the 3-codes/hour cap.
-- NOT APPLIED. Apply AFTER 20261102130000_members_gate_email_otp.sql and #56's 20261102170000_course_content.sql. Re-runnable.
--
-- Before: member_code_allowed only CHECKED the limits and member_code_record inserted the slot after
-- the send, so N parallel requests for one email could all pass the check (check-then-record race).
-- Now: member_code_allowed takes a transaction-scoped advisory lock per email hash, re-counts, and
-- RESERVES the email + IP slot in the same transaction when it returns true. Parallel calls for the
-- same email queue on the lock, so at most 3 can ever return true per hour.
-- member_code_record keeps its signature (no app change needed):
--   accepted = true  -> slot already reserved, nothing to add;
--   accepted = false -> release the newest reservation for that email + IP (Auth/CAPTCHA rejected the
--                       send, so a stranger's junk token still never uses up a member's slot) and add
--                       a row to the per-IP reject bucket, as before.
-- A crash between the two calls leaves the slot reserved (fails closed).
-- The per-IP caps (10 accepted/h, 20 rejects/h) are not locked per IP; they stay best-effort.

create or replace function public.member_code_allowed(p_email text, p_ip text)
returns boolean language plpgsql security definer set search_path = private, pg_temp as $$
declare
  v_eh text := private.email_hash(coalesce(p_email, ''));
  v_ih text := private.email_hash('ip:' || coalesce(p_ip, 'unknown'));
begin
  perform public.purge_member_gate_logs();
  if coalesce(btrim(p_email), '') = '' then return false; end if;
  if not exists (select 1 from private.member_allowlist where email_hash = v_eh) then return false; end if;
  -- Serialise per email hash; released at commit, so the count below sees every earlier reservation.
  perform pg_advisory_xact_lock(hashtextextended('gfx_member_code:' || v_eh, 0));
  if (select count(*) from private.member_code_requests where email_hash = v_eh and requested_at > now() - interval '1 hour') >= 3
     or (select count(*) from private.member_code_requests where ip_hash = v_ih and requested_at > now() - interval '1 hour') >= 10
     or (select count(*) from private.member_code_rejects where ip_hash = v_ih and rejected_at > now() - interval '1 hour') >= 20 then
    return false;
  end if;
  insert into private.member_code_requests (email_hash, ip_hash) values (v_eh, v_ih);
  return true;
end;
$$;
revoke all on function public.member_code_allowed(text, text) from public, anon, authenticated;
grant execute on function public.member_code_allowed(text, text) to service_role;

create or replace function public.member_code_record(p_email text, p_ip text, p_accepted boolean)
returns void language plpgsql security definer set search_path = private, pg_temp as $$
declare
  v_ih text := private.email_hash('ip:' || coalesce(p_ip, 'unknown'));
  v_eh text;
begin
  if p_accepted is true and coalesce(btrim(p_email), '') <> '' then
    return; -- slot was reserved by member_code_allowed
  end if;
  if coalesce(btrim(p_email), '') <> '' then
    v_eh := private.email_hash(p_email);
    perform pg_advisory_xact_lock(hashtextextended('gfx_member_code:' || v_eh, 0));
    delete from private.member_code_requests r
     where r.ctid = (select ctid from private.member_code_requests
                      where email_hash = v_eh and ip_hash = v_ih and requested_at > now() - interval '1 hour'
                      order by requested_at desc limit 1);
  end if;
  insert into private.member_code_rejects (ip_hash) values (v_ih);
end;
$$;
revoke all on function public.member_code_record(text, text, boolean) from public, anon, authenticated;
grant execute on function public.member_code_record(text, text, boolean) to service_role;

comment on function public.member_code_allowed(text, text) is 'GFX members gate: boolean send gate. Reserves the email + IP slot atomically (advisory lock per email hash) when it returns true.';
comment on function public.member_code_record(text, text, boolean) is 'GFX members gate: after the send. accepted -> keep the reserved slot; rejected -> release it and add a per-IP reject row.';
