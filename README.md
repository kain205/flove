# F-Love

F-Love is an AI-curated dating app for students. Instead of swipe-based discovery, users receive a short daily set of AI Picks with clear reasons. A chat opens only when both people accept the same recommendation.

## Core Features

| Feature | Description |
| --- | --- |
| AI Picks | Up to five curated recommendations with one overall compatibility index, its backend label, and data-backed reasons |
| F-Love AI Coach | Private Vietnamese preference coaching that maintains preferred and avoided soft traits |
| Messages + Wingman | Direct chat after mutual accept, with three private draft suggestions that never auto-send |
| Yêu lành mạnh 101 | Free native micro-course on relationship signals, boundaries, communication, and online safety |
| Chat widget | Authenticated quick inbox and composer synchronized with the full Messages experience |
| Profile | Verified-email student profile, bio, campus, major, interests, and avatar |

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
- `supabase/functions`: Edge Functions for AI Picks, feedback, mutual accept, AI Coach, private Wingman, and legacy Blind Date/reveal compatibility.
- `supabase/seed.sql`: optional local users, profiles, official matches, conversations, and realistic messages.
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

AI Picks currently runs in server-controlled `open` mode, so beta users see the full batch for free.
The additive backend also supports a test-only `stub` mode with one trial reveal and an idempotent
simulated whole-batch unlock priced at 100,000 VND. It does not integrate a payment gateway or record
a real purchase.

Configure Supabase Auth redirect URLs in the Dashboard:

- `flove://auth/callback`
- `flove://auth/reset-password`
- `https://your-vercel-domain/auth/callback`
- `https://your-vercel-domain/auth/reset-password`

## Vercel

The Vercel project `flove` builds from the repository root using the root `vercel.json`
(`npm run build:app:web` → `apps/app/dist`) and serves at `https://flove-app.vercel.app`.
Pushes to `main` on `kain205/flove` auto-deploy; `npx vercel deploy --prod` deploys manually.

- Environment Variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Seed Data

AI Picks generates candidates through a service-only filtered RPC. The optional local seed includes five
confirmed users plus two official conversations with realistic messages, unread state, and deterministic
login password `password123`. It is never deployed by the production migration flow.

```bash
supabase/seed.sql
```
