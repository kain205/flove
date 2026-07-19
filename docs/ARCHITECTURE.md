# F-Love Architecture

This file is the single architecture source of truth for F-Love. Update it in the same change whenever the app architecture, Supabase schema/RLS, Edge Functions, environment variables, deployment setup, route structure, or package boundaries change.

Do not duplicate architecture details across many docs. Keep `AGENT.md` and `CLAUDE.md` as short pointers back to this file.

## Project Purpose

F-Love is an AI-assisted dating and matchmaking app for FPT students. The main product surface is `AI Picks`: each user receives a short curated batch of recommended profiles with compatibility signals and explanations. A curated recommendation is not an official match until both users accept the same pair.

Core flows currently represented in the repository:

- Auth: Supabase email/password and Google OAuth through PKCE, restricted to exact `@fpt.edu.vn`
  account emails by a Before User Created hook plus runtime defense-in-depth checks.
- Onboarding/profile: profile fields, structured interests/tags/goals/vibes, profile completeness, and avatar storage contract.
- AI Picks: daily curated recommendations, feedback, accept/decline, and server-side mutual accept.
- Preference chat: user preference messages and assistant replies through an Edge Function.
- Messages/realtime chat: official conversations and messages after mutual accept.
- Blind Date: transactional anonymous queue/session, participant-safe chat, and mutual reveal.
- Safety: `reports`, `blocks`, `moderation_events`, and `user_safety_actions`; AI Picks exposes a report-and-hide action, while broader block controls remain a follow-up.

## Current Architecture Summary

- Primary product app: Expo React Native universal app in `apps/app`.
- Target surfaces: Android first, iOS later, web through Expo Web deployed on Vercel.
- Backend: Supabase Cloud for Auth, Postgres, RLS, Storage, Realtime, RPC, and Edge Functions.
- Shared code: `packages/core` for domain logic and `packages/supabase` for typed Supabase access.
- Legacy implementation: the old Vite/Firebase/Capacitor app was removed from the repository (July 2026 cleanup). F-Love is Expo + Supabase only; the pre-migration code is available in git history if ever needed.

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

scripts
  Support scripts: Supabase mock-profile seeding (`seed-supabase-profiles.mjs`, `mock-profiles.mjs`).

e2e
  Playwright smoke tests for the Expo web build (`playwright.config.ts` at the root).
```

## Runtime Surfaces

- Android: run the Expo app through Expo Go during early development, then use a development build when native/deep-link behavior needs validation.
- Web: Expo Web from `apps/app`, exported to `dist` and deployed on Vercel.
- iOS: configured in `apps/app/app.json` with bundle id and associated domains, but planned after Android-first validation.

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
AI_WORKER_SECRET
MATCH_METRICS_SAMPLE_RATE
```

`OPENAI_API_KEY` powers server-side onboarding analysis and queued AI jobs only. `OPENAI_MODEL`
selects the chat model; `OPENAI_EMBEDDING_MODEL` selects the fixed 1536-dimension embedding model.
`AI_WORKER_SECRET` authenticates only `process-ai-jobs` and must also be stored in Supabase Vault for
the Cron invocation. End-user functions use gateway JWT verification plus an in-function `getUser` check.
`MATCH_METRICS_SAMPLE_RATE` optionally controls aggregate hard-filter funnel logging (default `0.05`;
empty pools are always measured).
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

Schema lives in four additive migrations. `202607140001_backend_reliability.sql` is the v2 cutover
on top of the initial contract and notebook/vector migration. It backfills canonical readiness and
adds recoverable state without deleting v1 endpoints or data. `202607150001_blind_date_privacy.sql`
adds the anonymous data boundary and the scoped one-release message compatibility policy.

Important v2 objects and invariants:

- `profiles`: readiness is exclusively `profile_confirmed = true AND profile_completeness >= 75`.
  `ai_signals` is not a v2 readiness input; it is retained/backfilled for one released binary's route
  guard only. Onboarding answers/version, monotonic profile and
  embedding revisions, embedding status/error timestamps, and five `vector(1536)` columns are stored
  server-side. A trigger recomputes completeness; one-release legacy upsert columns are accepted but
  neutralized before revision/completeness triggers, so clients cannot control readiness, analysis,
  revisions, embeddings, or completeness. The same compatibility trigger binds email/owner/avatar to
  the authenticated FPT account and rejects or normalizes oversized display/discovery fields.
- `onboarding_drafts`: owner-readable autosave state with compare-and-swap `draft_revision`. Direct
  client writes are revoked. `save_onboarding_draft`, first-writer-wins `save_onboarding_analysis`, and
  `confirm_onboarding_profile_atomic` enforce that a confirmation uses the exact analyzed revision.
  Both SQL and Edge boundaries allow only the v2 question/field set and bound object, array and text sizes.
- `daily_match_batches`: one row per user/Vietnam business date with `generating | ready | empty |
  failed`, claim fencing, attempts, retry time, algorithm/profile/pool revision, and enrichment state.
  `match_generation_attempts` stores only timings, counts, outcomes, and error codes—never answers.
- `claim_daily_match_batch` and `finalize_daily_match_batch`: advisory-lock claim and transactional
  batch+match finalize. A batch is never marked ready before all match rows exist; stale claims cannot
  finalize. Empty rows retry on time or candidate-pool revision changes.
- `get_match_candidates_v2`: service-only SQL hard filters before each shortlist `LIMIT` (canonical readiness,
  mutual gender/age, two-way block/report, active safety actions, official matches, hard height/
  dealbreakers, and history cooldown). Six bare-distance, HNSW-eligible ANN branches form a bounded
  shortlist. Vectors are used only when `embedding_revision = profile_revision`; otherwise the shared
  scorer uses deterministic structured-signal fallbacks. The RPC returns scalar similarities and records, never
  arrays of 1536-dimensional vectors. Reported/blocked/matched pairs are permanent exclusions;
  displayed/declined/skipped profiles use a 30-day cooldown.
- `match_pair_live_eligible` and `get_daily_match_rows_v2`: pending cached rows are rechecked against
  current readiness, moderation, block/report, consent, and official-match state before either display or
  acceptance. Unsafe pending rows are repaired out of the batch; already-decided history is retained.
- `candidate_pool_state`: monotonic eligibility revision used to wake empty batches when the pool changes.
- `ai_jobs`: logged PGMQ queue accessed through service-only enqueue/read/delete/archive wrappers.
  `ai_job_registry` supplies idempotency. Profile embedding and match-enrichment completion RPCs fence
  stale revisions/attempts and allow enrichment to change prose only—not deterministic scores or ordering.
  A new profile revision deletes older uncompleted embedding messages for that user before enqueueing the
  latest revision, preventing edit bursts from filling the FIFO with obsolete provider work.
- `submit_match_feedback_atomic`, `save_preference_chat_turn_atomic`, `send_message_atomic`,
  `mark_conversation_read`, `find_blind_date_partner_atomic`, and `request_reveal_atomic`: authenticated,
  idempotent transactions for decisions, preference learning, messaging/read state, Blind Date claims,
  and reveal merge. Blind Date claims return only opaque IDs and a masked name; the counterpart UUID is
  returned only after mutual reveal.
- Onboarding review prose and Preference Chat prose are normalized server-side into bounded soft tokens.
  They can influence later deterministic ranking, but cannot loosen mutual consent/safety filters or
  create hard exclusions. Feedback is capped as one weighted score component.
- `get_blind_date_session` and `list_conversation_messages`: participant-scoped read contracts that hide
  raw session membership, UUID-keyed reveal state, message `sender_id`, and message idempotency keys.
  Message ownership is exposed only as the caller-relative `is_mine` boolean.
- `public_profiles` remains the cross-user display-safe view and includes only canonically ready,
  currently safe profiles. V2 own-profile queries and confirm responses explicitly omit vectors;
  private preferences, answers, analysis, internal attempts, queue state, and rate-limit buckets are
  not cross-user readable. The released binary's owner-only `profiles` SELECT remains for one
  compatibility release and must be replaced by a narrow own-profile RPC/view when that adapter is removed.
- Supabase Auth invokes `before_user_created_require_fpt` as `supabase_auth_admin`; all client/service HTTP
  roles are denied direct execution. `private.assert_fpt_self_admission` reads the canonical `auth.users`
  row inside every authenticated RPC (except the data-free business-date helper) and the one-release direct
  message/report/block RLS paths. The `private` schema is not exposed by the Data API. Edge admission,
  profile/view policies and avatar-write policies repeat the exact-domain check; service-role migration,
  repair and backfill paths bypass this user admission gate.
- Storage bucket `avatars`: FPT-owner writes/updates and public reads; object size is capped at 5 MiB and
  accepted MIME types are JPEG, PNG and WebP. Profile URLs must point to that user's bucket prefix.

RLS is the real access-control boundary:

- Users can select their own profile and edit only explicitly granted display/discovery columns.
- Users can read only their own onboarding draft; autosave writes must use the revision RPC.
- Users can read safe public profile fields through `public_profiles`.
- Users can read their own daily batches, curated matches, match feedback, preference profiles, and preference chat messages.
- Users can read safe conversation metadata only when they are participants. Anonymous conversation
  rows are forced to keep `pair_key`/`match_id` null and scrub sender UUIDs from `last_message` until reveal.
- Raw Blind Date sessions and anonymous messages are not client-readable; participant reads use the safe RPCs.
  During one compatibility release, the old binary may read/insert raw messages only in revealed,
  non-anonymous participant conversations; its insert trigger keeps summary/unread updates atomic.
- V2 message and all Blind Date queue writes are RPC-only. Queue rows cannot return to `waiting` after a session
  exists, preventing one participant from being paired twice.
- Users can create/read their own reports and blocks.
- Moderation events are hidden from clients.
- Safety actions are readable by the affected user.

Privileged logic must stay server-side:

- Clients cannot create official matches, conversations, participants, batches, analysis, or queue jobs.
- Feedback, messaging, Blind Date and reveal mutations go through their atomic RPCs with idempotency keys.
  The identity-bearing internal claim/reveal functions are owner-only and cannot be invoked by clients.
- Service-role functions authenticate the user first and pass the authenticated user ID into narrow RPCs.
- Mutating user endpoints carry a captured `expectedUserId`; Edge/RPC fences reject a response or write
  if the active session changed while a request was in flight.

Current Edge Functions use POST-only validation, request IDs, safe error envelopes and bounded paid
provider calls. Endpoint fields have explicit type/count/length limits; the Edge gateway remains the
whole-request body limit. Dependencies are pinned in `supabase/functions/deno.json`; the dependency-free scorer
in `packages/core/src/matching-engine.ts` is imported by both Node/browser and Deno code.

- `analyze-onboarding-profile`: reads an exact persisted draft revision, returns a cached analysis or
  an OpenAI/fallback canonical analysis inside a request-wide 12-second deadline, reserves persistence
  time before the provider deadline, and stores the result server-side.
- `confirm-onboarding-profile`: atomically confirms the exact draft+analysis revision, returns the
  persisted profile immediately, and kicks the durable embedding worker. It never waits for embeddings.
- `ensure-daily-matches`: resolves `Asia/Ho_Chi_Minh` date in Postgres, claims or loads the batch,
  performs deterministic scoring, atomically finalizes 1–5 picks, queues optional prose enrichment,
  and returns the batch directly. OpenAI is never on this critical path.
- `generate-daily-matches`: one-release compatibility adapter running the same v2 handler; client dates
  are intentionally ignored.
- The analyze/confirm endpoints also accept the released raw `{answers,basic}` payload for one release.
  The adapter persists it through the revision CAS, ignores client matching signals, and writes only a
  server-derived legacy guard projection.
- `process-ai-jobs`: worker-secret endpoint consuming logged profile-embedding and match-enrichment
  jobs. Embeddings are batched five bounded inputs per provider request and validated at 1536 dimensions;
  enrichment receives only bounded display snapshots and cannot change score/order.
- `submit-match-feedback`, `accept-curated-match`, `send-preference-chat-message`,
  `find-blind-date-partner`, and `request-reveal` wrap the atomic authenticated RPCs.

Structured logs contain request/outcome/stage latency, cached/generated source, safe counts and sampled
filter funnels. Worker outcomes also include queue age, delivery/read count, error code, and aggregate
maximums without logging raw onboarding answers. `get_backend_v2_alerts()` exposes the 2% failure,
3-second uncached p95, two-minute claim, and ten-minute embedding thresholds for the production alert
router; `backend_v2_slo.sql` is the read-only operator view. Finalize stores a durable generation-stage
duration immediately; after the response payload is loaded, a best-effort `waitUntil` patch records the
response-ready duration on the same fenced attempt without adding a metrics round-trip to matching's
critical path. The structured outcome log remains the authoritative end-to-end latency event.

Generated database types live in `packages/supabase/src/database.types.ts`. The current file is a checked-in type binding/stub aligned with the migration; after pushing migrations to Supabase Cloud, regenerate it with the linked project command in `package.json`.

## Frontend Architecture

The current target app is `apps/app`.

Expo Router routes:

- `app/index.tsx`: unauthenticated entry point. Authenticated sessions redirect to AI Picks; unauthenticated users see the marketing landing on web (`src/screens/WebLanding.tsx`) or the welcome splash on native (`src/screens/Welcome.tsx`).
- `app/(auth)/login.tsx`: email/password login and Google OAuth entry.
- `app/(auth)/signup.tsx`: email/password signup. It enters onboarding only when Supabase returns an
  authenticated session; when email confirmation is enabled, a session-less signup stays in a dedicated
  check-email state with login and change-email actions.
- `app/auth/callback.tsx`: OAuth and email-confirmation callback route.
- `app/auth/reset-password.tsx`: password reset route.
- `app/(tabs)/ai-picks.tsx`: typed loading/processing/empty/error/ready AI Picks states and
  idempotent accept/decline/skip/report actions.
- `app/(tabs)/blind-date.tsx`: Blind Date entry.
- `app/(tabs)/messages.tsx`: conversation list.
- `app/(tabs)/profile.tsx`: profile save/sign out shell.
- `app/preference-chat.tsx`: Profile-reachable preference-learning chat with owner-scoped history,
  bounded input, explicit retry UI, and stable idempotency keys for manual retries.
- `app/onboarding/index.tsx`: multi-step onboarding/profile interview (`src/screens/onboarding/OnboardingScreen.tsx`), guarded by an authenticated session.
- `app/chat/[conversationId].tsx`: message list through the relative-ownership RPC, idempotent send,
  atomic focus-time read acknowledgement, and reload-safe mutual reveal controls for Blind Date conversations.

Important app layers:

- `src/lib/supabase.ts`: creates the Supabase client with PKCE auth flow and fails fast when `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is missing.
- `src/lib/secureStorage.ts`: uses SecureStore on native and localStorage/memory fallback on web.
- `src/providers/AuthProvider.tsx`: Supabase session state.
- `src/providers/AppProviders.tsx`: React Query provider and foreground focus handling.
- `src/services/*`: app-facing service wrappers for auth, profile, matching, and preference chat.
- `src/i18n/index.ts`: i18next setup.
- `src/theme.ts`: design tokens (warm-orange palette, gradients, radii, spacing, fonts) shared across screens. Screens read tokens from here instead of hardcoding hex values.
- `src/components/*`: shared React Native primitives — `Button` (gradient/secondary/light), `TextField`, `BrandMark`, `Chip`, `MeterBar`, `Avatar`, `Screen`.
- `src/screens/*`: composed entry screens — `WebLanding` (web marketing landing), `Welcome` (native splash), and `onboarding/OnboardingScreen` (multi-step interview).
- `src/services/photos.ts`: uploads a profile photo to the public `avatars` Storage bucket under a `${userId}/...` path and returns its public URL.

UI design system: the app follows the F-Love warm-orange redesign (brand gradient `#F89233 → #EC6C1A` on cream `#FFF7EF`). Gradients use `expo-linear-gradient` and render on both web and native. The Plus Jakarta Sans / JetBrains Mono webfonts are injected at runtime on web by `AppProviders`; native falls back to the system font. The onboarding screen is the notebook AI setup (gradient progress, step-icon header, slide+fade step
transitions, a responsive desktop "notebook" card, decorative hearts, and a completion overlay): six
free-text-first steps (basic info incl. gender/looking-for/height/avatar, need, who-am-I, attraction +
appearance importance, communication, boundaries) where chips are hints only, followed by an AI Profile
Review step. Every step is autosaved to the owner-only revisioned draft, so reload/app termination
restores the answers and step. Editing answers invalidates the old analysis. The review calls
`analyze-onboarding-profile` for the persisted revision and shows five editable summary cards;
confirmation atomically writes the canonical profile, updates the user-scoped profile cache, and
navigates immediately while embeddings run in the queue. Edit-mode hydration compares server
timestamps: a newer canonical profile overlays basic fields and bio onto an older draft, while a newer
autosaved draft remains intact. Avatar upload is wired on web (DOM file input →
`avatars` bucket) and prompts to add the photo later on native.

Review edits are re-normalized on the server and never trusted as client-authored structured signals.
Changing the draft invalidates its analysis revision. Preference Chat likewise extracts bounded
canonical tokens server-side, so successful turns affect future soft ranking without changing hard
gender, age, block, report, safety, height, or dealbreaker constraints.

React Query owns initial loads and cached source of truth. Every protected key includes `userId`.
`AuthProvider` clears the entire query cache on account changes and installs user-scoped Realtime
invalidations for conversations/messages. Reads may retry once; matching generation and all mutations
disable automatic retries. AI Picks advances only after a successful server mutation and reloads only
pending rows. Candidate photos use the real avatar URL with a gradient/initial fallback.

Shared domain logic belongs in `packages/core`. Supabase mappers/query/function wrappers belong in `packages/supabase`. Avoid duplicating domain validation or row mapping inside feature screens.

## Deployment

### Supabase Cloud

Use Supabase Cloud, not local Supabase, as the default backend target.

```bash
supabase login
SUPABASE_PROJECT_REF=your-project-ref npm run supabase:link
psql "$PRODUCTION_DATABASE_URL" -f supabase/ops/pre_migration_audit.sql
npm run supabase:db:dry-run
npm run supabase:db:push
npm run supabase:config:push
npm run supabase:functions:deploy
npm run supabase:types
```

Run `supabase:config:push` only after the migration creates
`public.before_user_created_require_fpt(jsonb)`. It enables the
`pg-functions://postgres/public/before_user_created_require_fpt` Before User Created hook from
`supabase/config.toml`. In Supabase Dashboard → Authentication → Hooks, verify the hook is enabled in
production. The checked-in `[auth.email]` config explicitly keeps signups, double-confirmed email changes
and email confirmations enabled, so `config push` cannot silently inherit the local confirmation-off
default. Verify Google continues to return an owned, confirmed email through GoTrue as well.
The pre-migration audit reports aggregate legacy non-FPT Auth/profile ownership counts without selecting
individual email addresses, so those accounts can be handled explicitly before app cutover.

`supabase:functions:deploy` uses the API deployment path so the shared workspace scorer import is
included. CI first runs `supabase:functions:bundle`, which bundles every Edge entrypoint from the pinned
`deno.json`/lockfile and fails if an import is outside the deploy graph.

Set `AI_WORKER_SECRET` with `supabase secrets set`, then configure the one-minute durable Cron consumer
using `supabase/ops/schedule_ai_worker.sql`. The script stores URL/secret in Supabase Vault; replace its
placeholders interactively and never commit the values. `EdgeRuntime.waitUntil` only starts a fast path.
The logged PGMQ queue plus Cron is the delivery guarantee.

Rollout order:

1. Run the read-only production inventory and retain the result.
2. Push the additive migration, enable/verify the FPT Auth hook, then deploy v2 Edge Functions while the
   v1 adapter remains available.
3. Run backfill/repair checks and `supabase/ops/backend_v2_slo.sql`.
4. Cut the app over at 10%, 50%, then 100%, monitoring generation failure, uncached p95, stuck claims,
   and embedding queue age at every stage.
5. Keep `generate-daily-matches`, raw onboarding/profile-upsert adapters, and the revealed-message
   compatibility policy for one release. Remove them and freeze Firebase only after seven consecutive
   days meeting SLO.

Operational targets/alerts are: cached batch p95 <1s, uncached deterministic generation p95 <3s,
generation failures >2%, `generating` >2 minutes, or embedding pending/processing >10 minutes.

Supabase Auth redirect URLs (source of truth: `supabase/config.toml` `additional_redirect_urls`;
currently applied to the cloud project):

```text
flove://auth/callback
flove://auth/reset-password
https://flove.app/auth/callback
https://flove.app/auth/reset-password
https://flove-app.vercel.app/auth/callback
https://flove-app.vercel.app/auth/reset-password
https://f-connect-rho.vercel.app/auth/callback
https://f-connect-rho.vercel.app/auth/reset-password
```

Note: `supabase config push` with CLI 2.107 currently fails on the Storage config schema and can
clobber dashboard-tuned auth values that are unset in the toml (e.g. `otp_length`); those values are
now pinned in `config.toml` (`otp_length = 8`, `max_frequency = "60s"`). Prefer updating single auth
fields via the Management API until the CLI is upgraded.

Set Edge Function secrets in Supabase Cloud. Do not commit them.

### Vercel

Vercel project `flove` (team `kain205s-projects`, renamed from `f-connect`) deploys the Expo Web
build. The project root is the repository root; the root `vercel.json` is the live config:

```text
Install Command: npm install
Build Command: npm run build:app:web
Output Directory: apps/app/dist
Production domains: flove-app.vercel.app (primary), f-connect-rho.vercel.app (legacy alias)
```

The root `vercel.json` also rewrites all routes to `/index.html` so Expo Router deep links do not
404. Deploys run from the GitHub repo `kain205/flove` (renamed from `F-connect`; pushes to `main`
auto-deploy) or manually with `npx vercel deploy --prod`.

Vercel environment variables:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

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

## Testing And Verification

Actual scripts currently available:

```bash
npm --workspace @flove/core run test
npm --workspace @flove/supabase run test
npm --workspace @flove/app run typecheck
npm --workspace @flove/app run lint
npm run build:packages
npm run build:app:web
npm run supabase:functions:check
npm run supabase:functions:test
npm run test:e2e:web
npm run supabase:test
```

Notes:

- CI runs core/package tests, app typecheck/lint/web export, Deno Edge checks, local migration/seed and
  181 pgTAP contract/RLS/state-machine assertions (104 behavior and 77 RLS/ACL contracts).
- `npm run supabase:test` depends on Docker/local Supabase.
- `npm run supabase:types` writes `packages/supabase/src/database.types.ts`; only run it against the intended linked Supabase Cloud project.
- Expo Web export loads `apps/app/.env.local` when present. Never commit real env files.

Capture matching latency and the representative HNSW path before each rollout tier with
`supabase/ops/explain_matching_v2.sql`, using production-like pools of 100, 1,000, and 10,000 eligible
profiles. The helper is read-only and accepts `viewer_id` and `candidate_limit` as `psql` variables.

## Current Migration Status

Completed backend reliability v2 in the repository:

- Expo app shell exists in `apps/app`.
- Additive migration, protected RLS/grants, deterministic matching, durable AI queue worker and atomic
  interaction flows exist under `supabase`.
- Shared packages exist in `packages/core` and `packages/supabase`.
- Vercel config exists at `apps/app/vercel.json`.
- Client Supabase env template exists at `apps/app/.env.example`.

Legacy status: the Vite/Firebase/Capacitor code, its configs (`firebase.json`, rules files,
`capacitor.config.ts`, root Vite/Tailwind configs), the Android Capacitor project, and the legacy
Firebase seeder/env were deleted in the July 2026 cleanup. Recover from git history if ever needed.

Deployment/production follow-ups:

- TODO: run the pre-migration inventory against production; the linked database was unreachable from
  this workspace, so production counts and actual p95 are not recorded here.
- TODO: push the migration/config/functions, verify the FPT Auth hook with real password and Google
  signups, configure worker Cron/Vault secrets, regenerate types from the real project, and execute the
  staged 10/50/100 rollout.
- TODO: benchmark candidate pools at 100/1,000/10,000 production-like rows with `EXPLAIN (ANALYZE,
  BUFFERS)` and tune indexes/limit from measured plans.
- TODO: complete native avatar upload (currently web-only via DOM file input; native shows a "add photo later" prompt) and multi-photo support if the schema gains a `photos` column.
- TODO: implement richer conversation participant/profile joins; realtime invalidation/recovery is wired.
- TODO: add explicit block controls to matching, chat, and Blind Date UI; AI Picks report-and-hide and
  the live safety recheck are already wired.
- TODO: tune the v2 candidate cap, HNSW recall and deterministic weights from real latency/feedback data.

## Agent Rules

- Read this file before making architecture-affecting changes.
- Keep this file synchronized with code in the same PR/commit when changing schema, RLS, functions, env vars, deployment, routes, package boundaries, auth, realtime, storage, or legacy removal status.
- Prefer Supabase Cloud + Expo architecture unless the user explicitly asks otherwise.
- Do not commit secrets or generated local artifacts.
- Use actual scripts from `package.json` and `apps/app/package.json` when validating work.
