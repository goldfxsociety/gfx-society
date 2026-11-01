-- Run after applying 20261102130000_members_gate_email_proof.sql. Expect a single true.
select bool_and(ok) from (values
  (to_regprocedure('public.claim_membership(boolean)') is null),
  (to_regclass('private.member_claim_attempts') is null),
  (to_regclass('private.member_code_requests') is not null),
  (not has_function_privilege('anon', 'public.member_code_allowed(text,text)', 'execute')),
  (not has_function_privilege('authenticated', 'public.member_code_allowed(text,text)', 'execute')),
  (has_function_privilege('service_role', 'public.member_code_allowed(text,text)', 'execute')),
  (not has_function_privilege('authenticated', 'public.purge_member_gate_logs()', 'execute')),
  (has_function_privilege('authenticated', 'public.record_member_consent(text)', 'execute')),
  ((select prosrc like '%session_is_otp%' from pg_proc where oid = 'public.my_membership()'::regprocedure))
) v(ok);
