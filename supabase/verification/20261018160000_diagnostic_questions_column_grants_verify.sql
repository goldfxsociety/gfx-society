-- Verify 20261018160000_diagnostic_questions_column_grants.sql (read-only).

-- 1) Public columns: SELECT allowed for anon + authenticated. Expect all true.
select
  has_column_privilege('anon', 'public.diagnostic_questions', 'id', 'SELECT') as anon_id,
  has_column_privilege('anon', 'public.diagnostic_questions', 'question_key', 'SELECT') as anon_question_key,
  has_column_privilege('anon', 'public.diagnostic_questions', 'competency_key', 'SELECT') as anon_competency_key,
  has_column_privilege('anon', 'public.diagnostic_questions', 'question', 'SELECT') as anon_question,
  has_column_privilege('anon', 'public.diagnostic_questions', 'options', 'SELECT') as anon_options,
  has_column_privilege('anon', 'public.diagnostic_questions', 'chart', 'SELECT') as anon_chart,
  has_column_privilege('anon', 'public.diagnostic_questions', 'question_type', 'SELECT') as anon_question_type,
  has_column_privilege('anon', 'public.diagnostic_questions', 'difficulty', 'SELECT') as anon_difficulty,
  has_column_privilege('anon', 'public.diagnostic_questions', 'order_index', 'SELECT') as anon_order_index,
  has_column_privilege('anon', 'public.diagnostic_questions', 'is_published', 'SELECT') as anon_is_published,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'id', 'SELECT') as auth_id,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'question_key', 'SELECT') as auth_question_key,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'competency_key', 'SELECT') as auth_competency_key,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'question', 'SELECT') as auth_question,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'options', 'SELECT') as auth_options,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'chart', 'SELECT') as auth_chart,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'question_type', 'SELECT') as auth_question_type,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'difficulty', 'SELECT') as auth_difficulty,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'order_index', 'SELECT') as auth_order_index,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'is_published', 'SELECT') as auth_is_published;

-- 2) Answer columns: SELECT denied for anon + authenticated. Expect all false.
select
  has_column_privilege('anon', 'public.diagnostic_questions', 'explanation', 'SELECT') as anon_explanation,
  has_column_privilege('anon', 'public.diagnostic_questions', 'correct_index', 'SELECT') as anon_correct_index,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'explanation', 'SELECT') as auth_explanation,
  has_column_privilege('authenticated', 'public.diagnostic_questions', 'correct_index', 'SELECT') as auth_correct_index;

-- 3) Table-level SELECT: anon and authenticated must NOT have it (column grants only).
--    Expect both false.
select
  has_table_privilege('anon', 'public.diagnostic_questions', 'SELECT') as anon_table_select,
  has_table_privilege('authenticated', 'public.diagnostic_questions', 'SELECT') as auth_table_select;

-- 4) RPCs still executable by authenticated (SECURITY DEFINER path intact). Expect both true.
select
  has_function_privilege('authenticated', 'public.submit_diagnostic_answer(uuid,uuid,integer)', 'EXECUTE') as auth_submit,
  has_function_privilege('authenticated', 'public.get_diagnostic_results(uuid)', 'EXECUTE') as auth_results;
