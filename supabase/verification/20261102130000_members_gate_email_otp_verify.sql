-- SUPERSEDED by 20261102230000_drop_old_member_code_record.sql, which dropped
-- public.member_code_allowed(text,text) and public.member_code_record(text,text,boolean).
-- For the current state run supabase/verification/20261102230000_drop_old_member_code_record_verify.sql.
-- The privilege checks on the two dropped functions are replaced by "is dropped" checks so this script
-- no longer errors on a database at or after 20261102230000. Expect a single true there.
-- ALSO SUPERSEDED by 20261111000000_academy_login_membership.sql (Academy password login + consent), which
-- recreates private.member_claim_attempts and removes session_is_otp() from public.my_membership(). Those two
-- rows now accept either state; for the current membership checks run
-- supabase/verification/20261111000000_academy_login_membership_verify.sql.
-- Originally: run after applying 20261102130000_members_gate_email_proof.sql.
select bool_and(ok) from (values
  (to_regprocedure('public.claim_membership(boolean)') is null),
  (true), -- private.member_claim_attempts: dropped here, recreated by 20261111000000
  (to_regclass('private.member_code_requests') is not null),
  (to_regprocedure('public.member_code_allowed(text,text)') is null),          -- dropped by 20261102230000
  (to_regclass('private.member_code_rejects') is not null),
  (to_regprocedure('public.member_code_record(text,text,boolean)') is null),   -- dropped by 20261102230000
  (not has_function_privilege('authenticated', 'public.purge_member_gate_logs()', 'execute')),
  (has_function_privilege('authenticated', 'public.record_member_consent(text)', 'execute')),
  (to_regprocedure('public.my_membership()') is not null)  -- session_is_otp removed from it by 20261111000000
) v(ok);
