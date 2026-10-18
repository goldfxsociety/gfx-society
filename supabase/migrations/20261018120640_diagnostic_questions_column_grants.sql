-- Restore Phase 2A column-level SELECT on public.diagnostic_questions.
--
-- Risk: authenticated currently has table-level SELECT (relacl includes 'r'),
-- so explanation + correct_index are readable by any logged-in client even
-- though Phase 2A revoked them. That lets a learner scrape answers mid-quiz.
-- anon correctly has no table SELECT today; we still revoke+regrant for both
-- so the intended state cannot drift again for either role.
--
-- Root cause (read-only prod audit, 2026-10-18): no later repo migration
-- re-grants table SELECT on this table. Phase 2A only REVOKE SELECT + GRANT
-- SELECT (public cols). Live relacl shows authenticated=arwdDxtm (table
-- SELECT present) while anon=awdDxtm (no 'r'). Column ACLs on explanation /
-- correct_index are null, so they inherit the table grant. Likely source:
-- Supabase platform / dashboard default table grants (or a manual SQL grant
-- outside the repo) re-adding table SELECT after Phase 2A — not a later
-- content migration.
--
-- Fix: REVOKE SELECT (table + column) from anon, authenticated, then GRANT
-- SELECT on exactly the public columns the app/RPC design allows.
-- is_published is included so PostgREST .eq("is_published", true) keeps
-- working (Phase 2A omitted it; it only worked while table SELECT leaked).
--
-- SECURITY DEFINER RPCs (submit_diagnostic_answer, skip_diagnostic_question,
-- get_diagnostic_results) are unchanged and still read correct_index /
-- explanation as the function owner.
-- Idempotent: re-running leaves the same privilege state.
begin;

revoke select on table public.diagnostic_questions from anon, authenticated;

grant select (
  id,
  question_key,
  competency_key,
  question,
  options,
  chart,
  question_type,
  difficulty,
  order_index,
  is_published
) on table public.diagnostic_questions to anon, authenticated;

commit;
