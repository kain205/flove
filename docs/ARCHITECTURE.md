# F-Love Architecture

This file is the single architecture source of truth for F-Love. Update it in the same change whenever the app architecture, Supabase schema/RLS, Edge Functions, environment variables, deployment setup, route structure, or package boundaries change.

Do not duplicate architecture details across many docs. Keep `AGENT.md` and `CLAUDE.md` as short pointers back to this file.

## Project Purpose

F-Love is an AI-assisted dating and matchmaking app for FPT students. The main product surface is `AI Picks`: each user receives a short curated batch of recommended profiles with compatibility signals and explanations. A curated recommendation is not an official match until both users accept the same pair.

Core flows currently represented in the repository:

- Auth: Supabase email/password, Google OAuth through PKCE, callback routes, and password reset routes in the Expo app.
- Onboarding/profile: profile fields, structured interests/tags/goals/vibes, profile completeness, and avatar storage contract.
- AI Picks: daily curated recommendations, feedback, accept/decline, and server-side mutual accept.
- Preference chat: user preference messages and assistant replies through an Edge Function.
- Messages/realtime chat: official conversations and messages after mutual accept.
- Blind Date: anonymous queue/session/reveal Edge Function scaffolding.
- Safety: `reports`, `blocks`, `moderation_events`, and `user_safety_actions` schema exists; UI coverage is still incomplete.

## Current Architecture Summary

- Primary product app: Expo React Native universal app in `apps/app`.
- Target surfaces: Android first, iOS later, web through Expo Web deployed on Vercel.
- Backend: Supabase Cloud for Auth, Postgres, RLS, Storage, Realtime, RPC, and Edge Functions.
- Shared code: `packages/core` for domain logic and `packages/supabase` for typed Supabase access.
- Legacy implementation: the old Vite/Firebase/Capacitor app still exists under `src`, `functions`, `firebase.json`, `android`, and related files. Treat it as reference only. Do not build new product features there unless the user explicitly pauses/reverses the migration.

## Repository Structure

```text
apps/app
  Expo Router app, React Native UI, Supabase client setup, app services, i18n, Vercel config.

packages/core
  Shared domain types, validation, profile completeness, matching scoring, pair/date helpers, safety constants.

packages/supabase
  Typed Supabase client factory, database type bindings, row mappers, query helpers, Edge Function wrappers, realtime helpers.

supabase/migrations
  Cloud-first Postgres schema, enum types, RLS policies, storage policies, and RPC functions.

supabase/functions
  Supabase Edge Functions for AI Picks, feedback, mutual accept wrapper, preference chat, Blind Date, and reveal.

supabase/tests
  Database contract/RLS test files for the Supabase CLI test runner.

docs
  Architecture and project documentation. This file is the architecture source of truth.

src, functions, android, firebase.json, firestore.rules, storage.rules
  Legacy Vite/Firebase/Capacitor implementation. Use for reference only during migration.

scripts
  Legacy/support scripts, including mock user seeding for the old Firebase flow.
```

## Runtime Surfaces

- Android: run the Expo app through Expo Go during early development, then use a development build when native/deep-link behavior needs validation.
- Web: Expo Web from `apps/app`, exported to `dist` and deployed on Vercel.
- iOS: configured in `apps/app/app.json` with bundle id and associated domains, but planned after Android-first validation.
- Legacy web: Vite app can still be run only for comparison; it is not the target product surface.

## Environment Variables And Secrets

Client-exposed variables used by `apps/app`:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

These are safe to expose in the client because Supabase access control must be enforced by RLS and server-side functions, not by secrecy of the anon key.

Server-side Supabase Edge Function environment/secrets:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL
OPENAI_EMBEDDING_MODEL
```

`OPENAI_API_KEY` powers the server-side onboarding analysis, profile embeddings, and AI Picks
explanations, and must stay server-side. `OPENAI_MODEL` selects the chat model (onboarding analysis +
match explanations); `OPENAI_EMBEDDING_MODEL` selects the embedding model for `confirm-onboarding-profile`
(defaults to `text-embedding-3-small`, 1536-dim). Both default in code when unset.
`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and must never be exposed to the app or committed.

Never commit:

- `.env`, `.env.*`, `.env.local`, or app env files containing real values.
- Supabase service-role keys.
- OpenAI keys.
- Database passwords.
- JWT secrets.
- Supabase CLI temp metadata such as `supabase/.temp`.

Use `apps/app/.env.example` as the non-secret template for the Expo app.

## Supabase Backend

Supabase Cloud is the backend contract. `auth.users.id` is the canonical user identity, and `profiles.id` references `auth.users.id`.

Schema lives in `supabase/migrations/202606230001_initial_contract.sql`, extended additively by
`supabase/migrations/202606240001_notebook_onboarding.sql` (notebook AI onboarding + embedding
matching). Important objects:

- `profiles`: private/current user profile row; references `auth.users`. The notebook migration adds
  discovery/preference fields (`gender` enum + `gender_text`, `looking_for_gender[]`, `height_cm`,
  `age_pref_min/max`), structured preference JSON (`appearance_preference`, `dealbreakers`), the
  one-shot LLM output `ai_profile_analysis`, a `profile_confirmed` gate, and five `vector(1536)`
  embedding columns (`self/need/preference/communication/lifestyle_vector`) with HNSW cosine indexes
  (requires the `vector` extension).
- `public_profiles`: safe profile view for candidate/matching reads. Exposes display-safe fields only
  (now incl. `gender`, `height_cm`); discovery/appearance preferences, dealbreakers, the AI analysis,
  and all embeddings are intentionally excluded and never leave the server.
- `get_match_candidates(p_user_id, p_limit)`: `security definer` RPC that applies cheap hard filters
  (discovery/age/safety/blocks) + a coarse cosine prefilter and returns candidate rows with the five
  embeddings as `real[]`. Returns private vectors/preferences, so it is granted to `service_role`
  only (never `authenticated`); only the service-role matcher calls it.
- `preference_profiles`: preference summary, hard filters, soft preferences, feedback summary.
- `daily_match_batches`: daily AI Picks batch metadata.
- `curated_matches`: per-user recommendations and feedback status; the notebook migration adds
  `suggested_opener` (LLM-written opener for the chosen match).
- `match_feedback`: accepted/declined/skipped/reported feedback records.
- `matches`: official matches after mutual accept.
- `conversations`: chat container created by server-side match logic or Blind Date logic.
- `conversation_participants`: participant gate and unread counts.
- `messages`: chat messages visible only to participants.
- `preference_chat_messages`: preference chat transcript.
- `blind_date_queue` and `blind_date_sessions`: anonymous Blind Date matching/reveal support.
- `reports`, `blocks`, `moderation_events`, `user_safety_actions`: safety/moderation surface.
- Storage bucket `avatars`: owner writes/updates, public reads in the current migration.

RLS is the real access-control boundary:

- Users can select/insert/update only their own `profiles` row.
- Users can read safe public profile fields through `public_profiles`.
- Users can read their own daily batches, curated matches, match feedback, preference profiles, and preference chat messages.
- Users can read conversations/messages only when they are participants.
- Users can insert messages only into conversations they participate in.
- Users can create/read their own reports and blocks.
- Moderation events are hidden from clients.
- Safety actions are readable by the affected user.

Privileged logic must stay server-side:

- Clients must not directly create official `matches`.
- Clients must not forge `conversations` or `conversation_participants`.
- Mutual accept runs through `public.accept_curated_match(...)`, wrapped by the `accept-curated-match` Edge Function.
- Edge Functions that need privileged writes should authenticate the user first, then use service-role access only for the necessary server-side mutation.

Current Edge Functions in `supabase/functions` (shared Deno helpers live in `_shared/openai.ts`,
`_shared/scoring.ts` — a port of `@flove/core` `matching-vectors.ts` — and `_shared/analysis.ts`):

- `analyze-onboarding-profile`: one-shot LLM pass over the raw onboarding answers returning a strict
  `AIProfileAnalysis` for the review screen. No DB write; falls back to a deterministic analysis when
  `OPENAI_API_KEY` is missing or the call fails.
- `confirm-onboarding-profile`: persists the confirmed analysis, generates the five embeddings
  (`text-embedding-3-small`, overridable via `OPENAI_EMBEDDING_MODEL`), and sets `profile_confirmed`.
  Embedding failures are non-fatal (vectors stored null; matching degrades to signal-based scoring).
- `generate-daily-matches`: gates on `profile_confirmed`, calls `get_match_candidates`, applies the
  remaining hard filters + pairwise `finalScore` (mutual-preference cosine + need/comm/lifestyle/
  values/self/appearance/novelty − dealbreaker penalties) in JS, then uses one OpenAI call only to
  write `aiReason` + `suggestedOpener` + `compatibilityLabel` for the chosen 5. Deterministic fallback
  when OpenAI/vectors are unavailable.
- `submit-match-feedback`
- `accept-curated-match`
- `send-preference-chat-message`
- `find-blind-date-partner`
- `request-reveal`

Generated database types live in `packages/supabase/src/database.types.ts`. The current file is a checked-in type binding/stub aligned with the migration; after pushing migrations to Supabase Cloud, regenerate it with the linked project command in `package.json`.

## Frontend Architecture

The current target app is `apps/app`.

Expo Router routes:

- `app/index.tsx`: unauthenticated entry point. Authenticated sessions redirect to AI Picks; unauthenticated users see the marketing landing on web (`src/screens/WebLanding.tsx`) or the welcome splash on native (`src/screens/Welcome.tsx`).
- `app/(auth)/login.tsx`: email/password login and Google OAuth entry.
- `app/(auth)/signup.tsx`: email/password signup.
- `app/auth/callback.tsx`: OAuth callback route.
- `app/auth/reset-password.tsx`: password reset route.
- `app/(tabs)/ai-picks.tsx`: daily AI Picks list and accept/decline actions.
- `app/(tabs)/blind-date.tsx`: Blind Date entry.
- `app/(tabs)/messages.tsx`: conversation list.
- `app/(tabs)/profile.tsx`: profile save/sign out shell.
- `app/onboarding/index.tsx`: multi-step onboarding/profile interview (`src/screens/onboarding/OnboardingScreen.tsx`), guarded by an authenticated session.
- `app/chat/[conversationId].tsx`: message list and message send.

Important app layers:

- `src/lib/supabase.ts`: creates the Supabase client with PKCE auth flow and fails fast when `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is missing.
- `src/lib/secureStorage.ts`: uses SecureStore on native and localStorage/memory fallback on web.
- `src/providers/AuthProvider.tsx`: Supabase session state.
- `src/providers/AppProviders.tsx`: React Query provider and foreground focus handling.
- `src/services/*`: app-facing service wrappers for auth, profile, and matching.
- `src/i18n/index.ts`: i18next setup.
- `src/theme.ts`: design tokens (warm-orange palette, gradients, radii, spacing, fonts) shared across screens. Screens read tokens from here instead of hardcoding hex values.
- `src/components/*`: shared React Native primitives — `Button` (gradient/secondary/light), `TextField`, `BrandMark`, `Chip`, `MeterBar`, `Avatar`, `Screen`.
- `src/screens/*`: composed entry screens — `WebLanding` (web marketing landing), `Welcome` (native splash), and `onboarding/OnboardingScreen` (multi-step interview).
- `src/services/photos.ts`: uploads a profile photo to the public `avatars` Storage bucket under a `${userId}/...` path and returns its public URL.

UI design system: the app follows the F-Love warm-orange redesign (brand gradient `#F89233 → #EC6C1A` on cream `#FFF7EF`). Gradients use `expo-linear-gradient` and render on both web and native. The Plus Jakarta Sans / JetBrains Mono webfonts are injected at runtime on web by `AppProviders`; native falls back to the system font. The onboarding screen is the notebook AI setup (gradient progress, step-icon header, slide+fade step
transitions, a responsive desktop "notebook" card, decorative hearts, and a completion overlay): six
free-text-first steps (basic info incl. gender/looking-for/height/avatar, need, who-am-I, attraction +
appearance importance, communication, boundaries) where chips are hints only, followed by an AI Profile
Review step. The review calls `analyze-onboarding-profile` and shows five editable summary cards;
confirming calls `confirm-onboarding-profile` (which writes the profile + embeddings and sets
`profile_confirmed`) before AI Picks unlocks. Avatar upload is wired on web (DOM file input →
`avatars` bucket) and prompts to add the photo later on native.

React Query owns initial loads and cached source of truth. Supabase Realtime should append or invalidate updates only; mobile foreground/reconnect should refetch to recover missed events. `packages/supabase/src/realtime.ts` contains the current invalidation helper.

Shared domain logic belongs in `packages/core`. Supabase mappers/query/function wrappers belong in `packages/supabase`. Avoid duplicating domain validation or row mapping inside feature screens.

## Deployment

### Supabase Cloud

Use Supabase Cloud, not local Supabase, as the default backend target.

```bash
supabase login
SUPABASE_PROJECT_REF=your-project-ref npm run supabase:link
npm run supabase:db:dry-run
npm run supabase:db:push
npm run supabase:functions:deploy
npm run supabase:types
```

Configure Supabase Auth redirect URLs in the Supabase Dashboard:

```text
flove://auth/callback
flove://auth/reset-password
https://your-vercel-domain/auth/callback
https://your-vercel-domain/auth/reset-password
```

Set Edge Function secrets in Supabase Cloud. Do not commit them.

### Vercel

Vercel deploys the Expo Web build from `apps/app`.

Vercel project settings:

```text
Root Directory: apps/app
Build Command: npm run build:web
Output Directory: dist
```

Vercel environment variables:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

`apps/app/vercel.json` rewrites all routes to `/` so Expo Router deep links do not 404.

## Local Development

Install dependencies from the repository root:

```bash
npm install
```

Run the primary Expo app:

```bash
npm run dev:app
```

Usually use one Expo Metro server:

- Press `w` for Expo Web.
- Press `a` for Android with an emulator/device.
- Scan the QR code with Expo Go for quick device testing.

Android development requires the usual Android SDK/emulator or a device with ADB available. Use a development build later when OAuth, Android App Links, or other native behavior must be validated beyond Expo Go.

Run the legacy Vite app only for comparison:

```bash
npm run dev:legacy
```

Do not add new product features to the legacy Firebase/Capacitor app unless explicitly instructed.

## Testing And Verification

Actual scripts currently available:

```bash
npm --workspace @flove/core run test
npm --workspace @flove/supabase run test
npm --workspace @flove/app run typecheck
npm --workspace @flove/app run lint
npm run build:packages
npm run build:app:web
npm run supabase:test
```

Notes:

- `npm run supabase:test` depends on the Supabase CLI database test environment.
- `npm run supabase:types` writes `packages/supabase/src/database.types.ts`; only run it against the intended linked Supabase Cloud project.
- Expo Web export loads `apps/app/.env.local` when present. Never commit real env files.

## Current Migration Status

Completed foundation:

- Expo app shell exists in `apps/app`.
- Supabase migration, RLS policies, storage policy, and Edge Function scaffolds exist under `supabase`.
- Shared packages exist in `packages/core` and `packages/supabase`.
- Vercel config exists at `apps/app/vercel.json`.
- Client Supabase env template exists at `apps/app/.env.example`.

Legacy still present:

- Vite/Firebase/Capacitor code remains under `src`, `functions`, `android`, and Firebase config/rules files.
- Legacy Firebase env may exist in root `.env.local`; it is ignored and should be treated as legacy-only.

Known gaps / TODO:

- TODO: verify Supabase Cloud has been linked and migrations pushed after choosing the production project ref.
- TODO: verify generated `packages/supabase/src/database.types.ts` against the real Supabase Cloud schema after `npm run supabase:types`.
- TODO: complete native avatar upload (currently web-only via DOM file input; native shows a "add photo later" prompt) and multi-photo support if the schema gains a `photos` column.
- TODO: implement robust conversation list participant/profile joins and realtime recovery behavior in the Expo app.
- TODO: wire report/block flows into matching, chat, and Blind Date UI.
- TODO: tune the embedding matcher in production — candidate pool cap (`get_match_candidates` limit), HNSW recall, and the `finalScore` weights — once there is real userbase volume and feedback.
- TODO: remove Firebase/Capacitor/legacy web once Expo app reaches feature parity and cleanup is approved.

## Agent Rules

- Read this file before making architecture-affecting changes.
- Keep this file synchronized with code in the same PR/commit when changing schema, RLS, functions, env vars, deployment, routes, package boundaries, auth, realtime, storage, or legacy removal status.
- Prefer Supabase Cloud + Expo architecture unless the user explicitly asks otherwise.
- Do not commit secrets or generated local artifacts.
- Use actual scripts from `package.json` and `apps/app/package.json` when validating work.
