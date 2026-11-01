-- SUPERSEDED by 20261102230000_drop_old_member_code_record.sql, which dropped
-- public.member_code_allowed(text,text) and public.member_code_record(text,text,boolean).
-- For the current state run supabase/verification/20261102230000_drop_old_member_code_record_verify.sql.
-- The privilege checks on the two dropped functions are replaced by "is dropped" checks so this script
-- no longer errors on a database at or after 20261102230000. Expect a single true there.
-- Originally: run after applying 20261102130000_members_gate_email_proof.sql.
select bool_and(ok) from (values
  (to_regprocedure('public.claim_membership(boolean)') is null),
  (to_regclass('private.member_claim_attempts') is null),
  (to_regclass('private.member_code_requests') is not null),
  (to_regprocedure('public.member_code_allowed(text,text)') is null),          -- dropped by 20261102230000
  (to_regclass('private.member_code_rejects') is not null),
  (to_regprocedure('public.member_code_record(text,text,boolean)') is null),   -- dropped by 20261102230000
  (not has_function_privilege('authenticated', 'public.purge_member_gate_logs()', 'execute')),
  (has_function_privilege('authenticated', 'public.record_member_consent(text)', 'execute')),
  ((select prosrc like '%session_is_otp%' from pg_proc where oid = 'public.my_membership()'::regprocedure))
) v(ok);
