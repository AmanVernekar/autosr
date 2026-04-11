# AutoSR

Spaced repetition flashcard app. Auto-generates cards from uploaded content using Claude AI, scheduled with FSRS-4.5.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth + Storage)
- ts-fsrs for FSRS-4.5 scheduling
- Anthropic API (Haiku for structure extraction, Sonnet for card generation)

## Project Structure
- `src/app/` — Next.js App Router pages
- `src/app/api/` — API routes (ingest, generate)
- `src/lib/` — shared utilities (supabase clients, fsrs wrapper, types)
- `src/components/` — React components
- `supabase/migrations/` — SQL migration files

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## Conventions
- Dark theme: bg `#0f0f0f`, accent `#6366f1` (indigo)
- Server components by default, `'use client'` only when needed
- Supabase server client for server components/API routes, browser client for client components
- All `/app/*` routes are auth-protected via middleware
