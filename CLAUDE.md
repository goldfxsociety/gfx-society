@AGENTS.md

# GFX Society v2

This is the rebuild of GFX Academy into the larger **GFX Society** ecosystem (parent brand → Academy, Dashboard, Resources, Community, Broker, Admin). It is a fresh Next.js project, intentionally kept separate from the legacy `gfx-academy` repo (a static HTML app) so that app can keep running untouched while this one is built.

Stack: Next.js (App Router, TypeScript) + Tailwind CSS + shadcn/ui, Supabase (Postgres + Auth + Storage), deployed on Vercel. No other backend.

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (also runs typecheck)
- `npm run lint` — ESLint

## Environment variables
Copy `.env.example` to `.env.local` and fill in from the Supabase dashboard (Project Settings → API):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe to expose client-side.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, bypasses Row Level Security. Never prefix with `NEXT_PUBLIC_`, never import it into a client component, never commit a real value. Set it directly in Vercel's Environment Variables dashboard for production.

## Conventions
- `src/lib/supabase/client.ts` — browser Supabase client (Client Components only).
- `src/lib/supabase/server.ts` — server Supabase client (Server Components/Actions/Route Handlers).
- `src/proxy.ts` (not `middleware.ts` — this Next.js version renamed the convention to "Proxy") refreshes the Supabase auth session cookie on every request via `src/lib/supabase/middleware.ts`.
- Authorization is enforced at the database layer via Supabase Row Level Security, not just in the UI — any new table needs RLS policies before it's considered done.

## Where this is headed
Full target architecture (database schema, lesson engine design for migrating the 29 existing interactive lessons, referral/analytics/admin design) was worked out collaboratively and should be treated as the north star for structure — ask before deviating meaningfully from it (e.g. introducing a different data model for lessons, adding a service the plan didn't call for, etc.).
