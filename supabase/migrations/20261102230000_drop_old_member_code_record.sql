-- GFX members gate: drop the pre-#57 send-gate functions.
-- #57 (20261102200000) replaced member_code_allowed (check) + member_code_record (insert) with the atomic
-- member_code_reserve / member_code_finish pair and kept the old pair only so the previous app build kept
-- working during the rollout. #57's app (merge 488376d) is live and calls only reserve/finish.
-- Pre-checks (read-only, prod, 2 Nov 03:41 MYT): no app code calls the old functions; no pg_depend
-- dependents; no other function body references them; grants were service_role only.
-- Not touched: member_code_reserve, member_code_finish, purge_member_gate_logs, the log tables.
drop function if exists public.member_code_allowed(text, text);
drop function if exists public.member_code_record(text, text, boolean);
