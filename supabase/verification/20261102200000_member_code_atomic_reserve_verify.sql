-- Read-only. Returns one boolean: true when 20261102200000 is in place.
select
  position('pg_advisory_xact_lock' in pg_get_functiondef('public.member_code_reserve(text,text)'::regprocedure)) > 0
  and position('where id = p_reservation' in pg_get_functiondef('public.member_code_finish(uuid,text,text,boolean)'::regprocedure)) > 0
  and (select prosecdef from pg_proc where oid = 'public.member_code_reserve(text,text)'::regprocedure)
  and (select prosecdef from pg_proc where oid = 'public.member_code_finish(uuid,text,text,boolean)'::regprocedure)
  and not has_function_privilege('anon', 'public.member_code_reserve(text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.member_code_reserve(text,text)', 'execute')
  and has_function_privilege('service_role', 'public.member_code_reserve(text,text)', 'execute')
  and not has_function_privilege('anon', 'public.member_code_finish(uuid,text,text,boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.member_code_finish(uuid,text,text,boolean)', 'execute')
  and has_function_privilege('service_role', 'public.member_code_finish(uuid,text,text,boolean)', 'execute')
  and exists (select 1 from pg_constraint where conrelid = 'private.member_code_requests'::regclass and contype = 'p')
  and exists (select 1 from pg_constraint where conrelid = 'private.member_code_rejects'::regclass and contype = 'p')
  as member_code_atomic_reserve_ok;
