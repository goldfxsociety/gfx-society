-- 01_backup.sql
-- lesson-risk-dedupe spec (/workspace/gfx/design/trading-system/lesson-risk-dedupe-spec.md), 13 lessons.
-- Copies the 13 affected rows (id, slug, content, key_takeaways, updated_at) into a private backup table. Idempotent: on rerun
-- the FIRST backup is kept (on conflict do nothing), so a rerun after apply never overwrites the pre-apply copy.

begin;

create table if not exists public.lessons_backup_20261115_risk_dedupe (
  id uuid primary key,
  slug text not null,
  content text,
  key_takeaways jsonb,
  updated_at timestamptz,
  backed_up_at timestamptz not null default now()
);
-- Not an API table: RLS on with no policies, and no grants to the API roles.
alter table public.lessons_backup_20261115_risk_dedupe enable row level security;
revoke all on public.lessons_backup_20261115_risk_dedupe from anon, authenticated;

insert into public.lessons_backup_20261115_risk_dedupe (id, slug, content, key_takeaways, updated_at)
select l.id, l.slug, l.content, l.key_takeaways, l.updated_at
from public.lessons l
where l.slug in ('bull-market-vs-bear-market', 'candlestick-anatomy', 'candlestick-patterns', 'cents-account-your-first-real-money-practice', 'how-do-traders-make-money', 'opening-your-accm-account', 'pips-lots-and-leverage', 'real-money-and-your-emotions', 'stocks-vs-forex-vs-gold', 'types-of-orders', 'what-is-a-broker', 'what-is-a-spread', 'what-is-the-financial-market')
on conflict (id) do nothing;

-- Expect 13 rows.
select count(*) as backed_up_rows from public.lessons_backup_20261115_risk_dedupe;

commit;
