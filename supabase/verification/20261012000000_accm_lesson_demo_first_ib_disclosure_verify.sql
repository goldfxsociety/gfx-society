-- Verify 20261012000000_accm_lesson_demo_first_ib_disclosure.sql (read-only). Expect every column true.
select md5(content) = '8efeefd190a9c4ae11d15687c52c7094'                                     as content_matches_expected,
       content not ilike '%extra cost%'                          as no_extra_cost_claim,
       position('1. Create a free DEMO account in the MT5 app' in content) > 0
         and position('2. Check the broker''s licence' in content) > position('1. Create a free DEMO' in content)
         and position('3. Optional' in content) > position('2. Check the broker''s licence' in content) as steps_in_order,
       content not ilike '%Open a DEMO account first%'           as old_demo_after_registration_gone,
       content ilike '%usually based on trading volume%'         as new_disclosure_present,
       content not ilike '%VFSC%' and content not ilike '%SEC%'  as no_unverified_regulator_claim,
       jsonb_array_length(key_takeaways) = 3                     as takeaways_3,
       interactive_config is null                                as still_no_quiz,
       is_published                                              as still_published
from public.lessons where slug = 'opening-your-accm-account';

-- Site-wide DB check: no lesson says "extra cost". Expect 0.
select count(*) as extra_cost_hits from public.lessons
where content ilike '%extra cost%' or key_takeaways::text ilike '%extra cost%' or coalesce(interactive_config::text,'') ilike '%extra cost%';
