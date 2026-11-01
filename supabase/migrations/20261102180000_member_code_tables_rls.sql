-- GFX post-launch fix 1, item 6: RLS on the private code-request and reject tables, no policies.
-- NOT APPLIED. Apply AFTER 20261102130000_members_gate_email_otp.sql. Re-runnable.
-- Default-deny for every role that does not bypass RLS. service_role has BYPASSRLS, and the
-- SECURITY DEFINER functions (member_code_allowed / member_code_record / purge_member_gate_logs) run
-- as the table owner, which is not subject to RLS (RLS is not FORCED), so the gate keeps working.
alter table private.member_code_requests enable row level security;
alter table private.member_code_rejects enable row level security;
