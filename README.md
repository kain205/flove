# F-Love

F-Love is an AI-curated dating app for FPT students. Instead of swipe-based discovery, users receive a short daily set of AI Picks with clear reasons. A chat opens only when both people accept the same recommendation.

## Core Features

| Feature | Description |
| --- | --- |
| AI Picks | 3-5 curated recommendations per day with compatibility reasons |
| Preference Feedback | Accept, decline, skip, report, and preference chat signals improve future picks |
| Messages | Direct chat after mutual accept |
| Blind Date | Optional anonymous chat flow kept separate from AI Picks |
| Profile | FPT student profile, bio, campus, major, interests, and avatar |

## Tech Stack

- Expo React Native universal app in `apps/app`
- Expo Router, React Query, i18next, lucide-react-native
- Supabase Auth, Postgres, Storage, Realtime, Edge Functions
- Shared TypeScript packages in `packages/core` and `packages/supabase`
- i18next

## Architecture

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the product model, Supabase shape, Expo app structure, matching lifecycle, feedback learning lifecycle, and cleanup notes.

## Development

```bash
npm install
npm run dev:app
```

The primary app uses Supabase Cloud. Create `apps/app/.env.local` from `apps/app/.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Checks

```bash
npm test
npm --workspace @flove/app run typecheck
npm run build:packages
```

## Supabase Backend

The backend contract lives in `supabase/`:

- `supabase/migrations`: Postgres schema, RLS, storage policies, and RPC transactions.
- `supabase/functions`: Edge Functions for AI Picks, feedback, mutual accept, preference chat, Blind Date, and reveal.
- `supabase/seed.sql`: optional seed users/profiles for non-production environments.
- `supabase/tests`: database contract tests when the Supabase CLI test runner is available.

Cloud-first setup:

```bash
supabase login
SUPABASE_PROJECT_REF=your-project-ref npm run supabase:link
npm run supabase:db:dry-run
npm run supabase:db:push
npm run supabase:functions:deploy
```

Generate typed database bindings from the linked Supabase Cloud project:

```bash
npm run supabase:types
```

Run database tests when the CLI environment supports it:

```bash
npm run supabase:test
```

Keep OpenAI keys and service-role keys only in Supabase secrets/Edge Function environment, never in `EXPO_PUBLIC_*`.

Configure Supabase Auth redirect URLs in the Dashboard:

- `flove://auth/callback`
- `flove://auth/reset-password`
- `https://your-vercel-domain/auth/callback`
- `https://your-vercel-domain/auth/reset-password`

## Vercel

Deploy the Expo Web output from `apps/app`.

Vercel project settings:

- Root Directory: `apps/app`
- Build Command: `npm run build:web`
- Output Directory: `dist`
- Environment Variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The app includes `apps/app/vercel.json` so deep links and Expo Router routes rewrite back to `/`.

## Seed Data

AI Picks reads candidates from Supabase `public_profiles`. Optional seed profiles are defined in:

```bash
supabase/seed.sql
```
