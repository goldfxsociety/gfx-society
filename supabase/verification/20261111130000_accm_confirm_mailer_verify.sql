-- Read-only. One result set: (check, ok). No emails, tokens or secrets are returned; the only row-level reads are
-- boolean existence checks. BEFORE applying 20261111130000_accm_confirm_mailer.sql: the new rows are false.
-- AFTER applying: every row must be true. Also re-run 20261111120000_access_requests_verify.sql and
-- 20261111000000_academy_login_membership_verify.sql (both must stay all true).
-- At go-live (switch set to 'true' with Jarvis's go) the row 'mail switch is off' becomes false by design; every
-- other row must stay true.
with f as (
  select n.nspname || '.' || p.proname as name, p.prosrc, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') as cfg
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.oid in (
    coalesce(to_regprocedure('private.accm_confirm_mail_live()'), 0)::oid,
    coalesce(to_regprocedure('public.submit_access_request(text,text,text,text)'), 0)::oid,
    coalesce(to_regprocedure('public.issue_accm_confirm_token(uuid)'), 0)::oid,
    coalesce(to_regprocedure('public.confirm_accm_email(text)'), 0)::oid,
    coalesce(to_regprocedure('private.match_access_requests()'), 0)::oid,
    coalesce(to_regprocedure('private.member_hashes(uuid)'), 0)::oid)
)
select 'N3 switch row exists in private.app_settings' as check,
       exists (select 1 from private.app_settings where key = 'accm_confirm_mail_live') as ok
union all
select 'mail switch is off (expected until go-live)', not coalesce((select value = 'true' from private.app_settings where key = 'accm_confirm_mail_live'), false)
union all
select 'private.accm_confirm_mail_live(): SECURITY DEFINER, pinned search_path, not executable by anon/authenticated',
       (select count(*) = 1 and bool_and(prosecdef and cfg = 'search_path=private, public, pg_temp') from f where name = 'private.accm_confirm_mail_live')
       and not has_function_privilege('anon', 'private.accm_confirm_mail_live()', 'execute')
       and not has_function_privilege('authenticated', 'private.accm_confirm_mail_live()', 'execute')
union all
select 'N3 guard: submit refuses an ACCM email unless the switch is on',
       (select coalesce(bool_and(prosrc like '%accm_confirm_mail_live()%' and prosrc like '%accm_email_disabled%'), false) from f where name = 'public.submit_access_request')
union all
select 'N3 guard holds now: no raw ACCM email stored while the switch is off',
       coalesce((select value = 'true' from private.app_settings where key = 'accm_confirm_mail_live'), false)
       or not exists (select 1 from private.access_request_accm where accm_email is not null)
union all
select 'N3 guard holds now: no awaiting_email_confirm request while the switch is off',
       coalesce((select value = 'true' from private.app_settings where key = 'accm_confirm_mail_live'), false)
       or not exists (select 1 from public.access_requests where status = 'awaiting_email_confirm')
union all
select 'issue_accm_confirm_token: switch-gated, service_role only (never anon/authenticated)',
       (select coalesce(bool_and(prosrc like '%accm_confirm_mail_live()%'), false) from f where name = 'public.issue_accm_confirm_token')
       and has_function_privilege('service_role', 'public.issue_accm_confirm_token(uuid)', 'execute')
       and not has_function_privilege('anon', 'public.issue_accm_confirm_token(uuid)', 'execute')
       and not has_function_privilege('authenticated', 'public.issue_accm_confirm_token(uuid)', 'execute')
union all
select 'only issue_accm_confirm_token creates a raw token (no other public/private function makes 32 random bytes)',
       (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private') and p.prosrc like '%gen_random_bytes(32)%'
           and p.prosrc like '%''token''%')
union all
select 'N1 confirm_accm_email: authenticated only (anon cannot), switch-gated, bound to auth.uid() = request owner',
       has_function_privilege('authenticated', 'public.confirm_accm_email(text)', 'execute')
       and not has_function_privilege('anon', 'public.confirm_accm_email(text)', 'execute')
       and (select coalesce(bool_and(prosrc like '%auth.uid()%' and prosrc like '%v_r.user_id is distinct from v_uid%'
                                     and prosrc like '%accm_confirm_mail_live()%'), false) from f where name = 'public.confirm_accm_email')
union all
select 'N5 raw ACCM email is cleared on confirm (accm_email = null with token_used_at)',
       (select coalesce(bool_and(prosrc like '%token_used_at = now(), accm_email = null%'), false) from f where name = 'public.confirm_accm_email')
union all
select 'N5 member_hashes: a CONFIRMED Academy email counts (email_confirmed_at is not null); ACCM only when confirmed + matched',
       (select coalesce(bool_and(prosrc like '%u.email_confirmed_at is not null%' and prosrc like '%accm_email_confirmed_at is not null%'
                                 and prosrc like '%status = ''matched''%'), false) from f where name = 'private.member_hashes')
union all
select 'N2/N5 refresh checks pending AND awaiting_email_confirm; ACCM email only when confirmed',
       (select coalesce(bool_and(prosrc like '%status in (''pending'', ''awaiting_email_confirm'')%'
                                 and prosrc like '%accm_email_confirmed_at is not null and a.email_hash = q.accm_email_hash%'), false)
          from f where name = 'private.match_access_requests')
union all
select 'refresh matcher still not executable by anon/authenticated',
       not has_function_privilege('anon', 'private.match_access_requests()', 'execute')
       and not has_function_privilege('authenticated', 'private.match_access_requests()', 'execute')
union all
select 'redefined public RPCs keep SECURITY DEFINER + search_path=public, pg_temp',
       (select count(*) = 3 and bool_and(prosecdef and cfg = 'search_path=public, pg_temp') from f
         where name in ('public.submit_access_request', 'public.issue_accm_confirm_token', 'public.confirm_accm_email'));
