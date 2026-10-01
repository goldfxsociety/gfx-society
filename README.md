# GFX Society

GFX Society is the parent ecosystem evolving out of GFX Academy — free Gold/XAUUSD trading education and community for Filipino traders. This repo is the v2 rebuild (Next.js + Supabase), built alongside the existing live Academy (a separate, untouched static site) rather than replacing it in place.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project URL + anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- **Next.js** (App Router, TypeScript) — frontend + API routes
- **Tailwind CSS + shadcn/ui** — styling/components
- **Supabase** — Postgres database, authentication, file storage
- **Vercel** — hosting

See `CLAUDE.md` for architecture conventions and environment variable setup.
