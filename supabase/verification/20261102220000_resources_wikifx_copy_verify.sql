-- Read-only. Returns one boolean: true when no resource still has the WikiFX "Before depositing" sentence.
select not exists (
  select 1 from public.resources
   where coalesce(description, '') ilike '%before depositing with any broker%'
      or (title ilike '%wikifx%' and coalesce(description, '') ilike '%verified here%')
) as resources_wikifx_copy_ok;
