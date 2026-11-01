-- Verify 20261102160000_lessons_partner_broker_line.sql (read-only). Expect every column true.
select
  not exists (select 1 from public.lessons where lessons::text ilike '%any broker you choose%') as no_any_broker_you_choose,
  not exists (select 1 from public.lessons where lessons::text ilike '%may earn a commission%') as no_commission_disclosure,
  not exists (select 1 from public.lessons where lessons::text ilike '%IB for ACCM%' or lessons::text ilike '%Introducing Broker (IB) for ACCM%') as no_ib_for_accm_line,
  not exists (select 1 from public.lessons where lessons::text ilike '%Verify any broker''s licence%') as c2_verify_reworded,
  not exists (select 1 from public.lessons where lessons::text ilike '%before choosing any broker?%') as c2_question_reworded,
  exists (select 1 from public.lessons where lessons::text like '%ACCM is GFX''s partner broker.%') as partner_line_present;
