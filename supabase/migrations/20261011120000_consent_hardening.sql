-- ==========================================================
-- Consent hardening (QA re-test R1, R2, R3, R4 + retention). NOT APPLIED.
-- Live state checked read-only on 2026-10-10: 20261010151211 signup_consent_records
-- is applied; consent_records has 0 rows; pgcrypto is in schema `extensions`.
-- Idempotent: every step is IF [NOT] EXISTS / CREATE OR REPLACE / re-runnable.
-- ==========================================================

-- pgcrypto (for sha256 via digest). Already in `extensions` on this project.
create extension if not exists pgcrypto with schema extensions;

-- ---------- Retention: keep consent evidence after account deletion ----------
-- user_id becomes nullable and the FK uses ON DELETE SET NULL, so deleting a
-- user keeps the consent row (linked only by email_hash) for the 3-year
-- retention in the Privacy Notice.
alter table public.consent_records alter column user_id drop not null;
alter table public.consent_records add column if not exists email_hash text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.consent_records'::regclass
      and conname = 'consent_records_user_id_fkey'
      and confdeltype <> 'n'   -- 'n' = SET NULL
  ) then
    alter table public.consent_records drop constraint consent_records_user_id_fkey;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.consent_records'::regclass
      and conname = 'consent_records_user_id_fkey'
  ) then
    alter table public.consent_records
      add constraint consent_records_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end $$;

create index if not exists consent_records_email_hash_idx on public.consent_records (email_hash);
create index if not exists consent_records_user_id_idx on public.consent_records (user_id);

-- Backfill email_hash for any existing rows (0 on prod today).
update public.consent_records c
set email_hash = encode(extensions.digest(lower(u.email), 'sha256'), 'hex')
from auth.users u
where c.user_id = u.id and c.email_hash is null and u.email is not null;

-- ---------- R3: no IP data at all ----------
-- ip_hash was never populated (always NULL) and the Privacy Notice makes no IP claim.
alter table public.consent_records drop column if exists ip_hash;

-- ---------- R1 + R2(audit): trigger never fails a signup ----------
-- Safe conversion helpers: only JSON true or the string "true" count as true;
-- anything else (null, "yes", 1, objects, junk) becomes false;
-- an unparseable timestamp becomes NULL. They never raise.
create or replace function public.consent_bool(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when v is null then false
    when jsonb_typeof(v) = 'boolean' then v = 'true'::jsonb
    when jsonb_typeof(v) = 'string' then lower(btrim(v #>> '{}')) = 'true'
    else false
  end;
$$;

create or replace function public.consent_ts(v text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if v is null or btrim(v) = '' then return null; end if;
  return v::timestamptz;
exception when others then
  return null;
end;
$$;

-- Records a consent row for EVERY new auth user (email, OAuth, admin-created,
-- invited). Users who signed up without the site's consent form get
-- consent_version 'none' and consent_required false, so they can be audited.
-- Any unexpected error is caught and logged as a WARNING: the trigger must
-- never roll back the auth.users insert (no "Database error saving new user").
create or replace function public.record_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_version text;
  v_level text;
begin
  begin
    v_version := nullif(btrim(coalesce(md->>'consent_version', '')), '');
    v_level := nullif(btrim(coalesce(md->>'experience_level', '')), '');
    if v_level is not null and v_level not in ('never_traded', 'demo_only', 'trading_live') then
      v_level := null;
    end if;

    insert into public.consent_records
      (user_id, email_hash, consent_version, consent_required, consent_marketing,
       experience_level, client_consented_at, source)
    values (
      new.id,
      case when new.email is not null
           then encode(extensions.digest(lower(new.email), 'sha256'), 'hex') end,
      left(coalesce(v_version, 'none'), 100),
      public.consent_bool(md->'consent_required'),
      public.consent_bool(md->'consent_marketing'),
      v_level,
      public.consent_ts(md->>'consented_at'),
      case when v_version is null
           then 'no_consent_form:' || coalesce(new.raw_app_meta_data->>'provider', 'unknown')
           else 'signup' end
    );
  exception when others then
    raise warning 'record_signup_consent failed for user %: % (%)', new.id, sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

revoke all on function public.record_signup_consent() from public, anon, authenticated;
revoke all on function public.consent_bool(jsonb) from public, anon, authenticated;
revoke all on function public.consent_ts(text) from public, anon, authenticated;

-- (Re)create the trigger idempotently.
drop trigger if exists on_auth_user_created_consent on auth.users;
create trigger on_auth_user_created_consent
  after insert on auth.users
  for each row execute function public.record_signup_consent();

-- ---------- R2 (optional, founder-enabled): reject email signups without consent ----------
-- Supabase "before-user-created" auth hook. Returns a clean 400 with a clear
-- message instead of a 500. Only rejects provider = 'email' signups that are
-- not explicitly marked. OAuth and other providers pass.
-- Admin-created users and invites also use provider 'email': create them with
-- user_metadata {"consent_source": "admin"} (or have them consent), otherwise
-- the hook blocks them. Enabling the hook is a dashboard step:
-- Authentication -> Hooks -> Before User Created -> Postgres -> public.hook_require_signup_consent.
create or replace function public.hook_require_signup_consent(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  u jsonb := coalesce(event->'user', '{}'::jsonb);
  md jsonb := coalesce(u->'user_metadata', '{}'::jsonb);
  provider text := coalesce(u->'app_metadata'->>'provider', 'email');
begin
  if provider <> 'email' then
    return '{}'::jsonb;
  end if;
  if md->>'consent_source' = 'admin' then
    return '{}'::jsonb;
  end if;
  if public.consent_bool(md->'consent_required') then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 400,
    'message', 'Please tick the consent box (18+, Terms of Use and Privacy Notice) to create your account.'
  ));
exception when others then
  return '{}'::jsonb;  -- never block signups because of a hook bug
end;
$$;

grant execute on function public.hook_require_signup_consent(jsonb) to supabase_auth_admin;
grant execute on function public.consent_bool(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_require_signup_consent(jsonb) from public, anon, authenticated;

-- ---------- R4: least-privilege grants ----------
-- Clients only ever need SELECT on their own rows (RLS policy unchanged).
revoke all on table public.consent_records from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.consent_records from authenticated;
grant select on table public.consent_records to authenticated;
