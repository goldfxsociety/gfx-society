-- ==========================================================
-- Signup consent records (RA 10173). FILE ONLY — NOT APPLIED.
-- Consent is sent by the signup form in auth user metadata:
--   consent_version, consent_required (bool), consent_marketing (bool),
--   experience_level, consented_at (client ISO time; server time is also stored)
-- An AFTER INSERT trigger on auth.users copies it into consent_records.
-- handle_new_user() is NOT modified.
-- TODO(legal/founder): hashed IP is not captured (needs a server route); column kept nullable.
-- ==========================================================

create table if not exists public.consent_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_version text not null,
  consent_required boolean not null default false,
  consent_marketing boolean not null default false,
  experience_level text,
  client_consented_at timestamptz,
  ip_hash text,
  source text not null default 'signup',
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index if not exists consent_records_user_id_idx on public.consent_records(user_id);

alter table public.consent_records enable row level security;

-- Users may read their own consent history. No insert/update/delete from the API:
-- writes come only from the trigger below (and, later, a withdraw RPC).
drop policy if exists "users can view own consent records" on public.consent_records;
create policy "users can view own consent records" on public.consent_records
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.consent_records from anon;
revoke insert, update, delete on public.consent_records from authenticated;
grant select on public.consent_records to authenticated;

create or replace function public.record_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if md ? 'consent_version' then
    insert into public.consent_records
      (user_id, consent_version, consent_required, consent_marketing, experience_level, client_consented_at)
    values (
      new.id,
      md->>'consent_version',
      coalesce((md->>'consent_required')::boolean, false),
      coalesce((md->>'consent_marketing')::boolean, false),
      nullif(md->>'experience_level', ''),
      nullif(md->>'consented_at', '')::timestamptz
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.record_signup_consent() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_consent on auth.users;
create trigger on_auth_user_created_consent
  after insert on auth.users
  for each row execute function public.record_signup_consent();
