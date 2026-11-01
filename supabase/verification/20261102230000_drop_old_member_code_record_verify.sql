-- Run each statement separately (the MCP returns only the last result). Every one must return true.
select to_regprocedure('public.member_code_allowed(text,text)') is null as old_allowed_gone;
select to_regprocedure('public.member_code_record(text,text,boolean)') is null as old_record_gone;
select to_regprocedure('public.member_code_reserve(text,text)') is not null as reserve_exists;
select to_regprocedure('public.member_code_finish(uuid,text,text,boolean)') is not null as finish_exists;
select has_function_privilege('service_role', 'public.member_code_reserve(text,text)', 'execute') as reserve_service_role;
select not has_function_privilege('anon', 'public.member_code_reserve(text,text)', 'execute') and not has_function_privilege('authenticated', 'public.member_code_reserve(text,text)', 'execute') as reserve_not_public;
select has_function_privilege('service_role', 'public.member_code_finish(uuid,text,text,boolean)', 'execute') as finish_service_role;
select not has_function_privilege('anon', 'public.member_code_finish(uuid,text,text,boolean)', 'execute') and not has_function_privilege('authenticated', 'public.member_code_finish(uuid,text,text,boolean)', 'execute') as finish_not_public;
select to_regprocedure('public.purge_member_gate_logs()') is not null as purge_exists;
