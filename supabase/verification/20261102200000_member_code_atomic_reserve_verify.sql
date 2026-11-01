-- Read-only. Returns one boolean: true when 20261102200000 is in place.
select
  position('pg_advisory_xact_lock' in pg_get_functiondef('public.member_code_allowed(text,text)'::regprocedure)) > 0
  and position('insert into private.member_code_requests' in pg_get_functiondef('public.member_code_allowed(text,text)'::regprocedure)) > 0
  and position('slot was reserved' in pg_get_functiondef('public.member_code_record(text,text,boolean)'::regprocedure)) > 0
  and (select prosecdef from pg_proc where oid = 'public.member_code_allowed(text,text)'::regprocedure)
  and not has_function_privilege('anon', 'public.member_code_allowed(text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.member_code_allowed(text,text)', 'execute')
  and has_function_privilege('service_role', 'public.member_code_allowed(text,text)', 'execute')
  and not has_function_privilege('anon', 'public.member_code_record(text,text,boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.member_code_record(text,text,boolean)', 'execute')
  as member_code_atomic_reserve_ok;
