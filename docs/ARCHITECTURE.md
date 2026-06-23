# F-Love Architecture

## Product Model

F-Love is now an AI-curated dating app for FPT students. The core matching surface is `AI Picks`: each user receives a short daily batch of 3-5 recommended profiles, each with an explanation and compatibility signal. There is no swipe flow.

Official matches are created only after mutual accept. A curated recommendation is not a match; it becomes a match after both users accept the same pair. Messages are only available for official matches.

Blind Date remains a separate optional feature. It does not feed the AI-curated matching flow in v1.

## Target Runtime And Repository Model

F-Love is migrating to Supabase Cloud plus one universal Expo React Native app. The Expo app is the primary product surface, validated on Android first, then iOS, with Expo Web/Vercel supported only when it can come from the same app codebase.

The legacy Vite/Firebase/Capacitor web app remains a temporary reference while the Expo app reaches feature parity. Do not build new product features on the legacy Firebase/Capacitor app.

Planned monorepo structure:

```text
apps/app              Expo universal app
packages/core         shared domain types, validation, scoring, profile readiness
packages/supabase     typed Supabase client, mappers, queries, RPC/function wrappers
supabase              Cloud schema migrations, RLS, seed data, tests, Edge Functions
```

## Frontend Modules

- `ai-picks`: daily curated recommendations, feedback controls, and preference chat.
- `messages`: direct conversations after mutual accept.
- `blind-date`: anonymous chat/reveal flow kept as a secondary feature.
- `profile`: real user profile, onboarding signals, bio/quick answers, interests, major, campus, and avatar.
- `auth`: FPT email/password login/signup, Google OAuth, password reset, and profile bootstrap.

The new frontend uses React Native primitives, Expo Router, React Query, i18next, `lucide-react-native`, and Supabase Cloud. AI provider calls and privileged match/conversation writes stay behind Supabase Edge Functions or RPC transactions; the client only talks to app services.

## Services And Data Flow

- `curatedMatchService`
  - Reads or creates today's batch.
  - Reads `curatedMatches`.
  - Records accept/decline/skip/report feedback.
  - Calls server-side mutual accept logic. Clients cannot create official `matches`, `conversations`, or `conversation_participants` directly.
  - Uses Supabase Cloud Edge Functions for generation/feedback and an RPC transaction for mutual accept.

- `preferenceChatService`
  - Stores user preference chat messages.
  - Updates `preferenceProfiles` from chat hints.
  - Uses Supabase Edge Functions for assistant replies and preference updates.

- `aiBackendService`
  - Supabase Edge Function adapter for `generate-daily-matches`, `submit-match-feedback`, `accept-curated-match`, and `send-preference-chat-message`.

React Query performs initial loads and owns cached source of truth. Supabase Realtime is used only to append or invalidate updates, with mobile foreground/reconnect refetches to recover missed events.

## Supabase Shape

```text
profiles
public_profiles
preference_profiles
daily_match_batches
curated_matches
match_feedback
matches
conversations
conversation_participants
messages
preference_chat_messages
blind_date_queue
blind_date_sessions
reports
blocks
moderation_events
user_safety_actions
```

Important fields:

- `profiles.profile_text`: user-facing text inputs for matching context (`bio`, `weekendStyle`, `conversationStyle`, `memorableThing`, `relationshipIntent`).
- `profiles.interests`, `profiles.personality_tags`, `profiles.dating_goals`, `profiles.preferred_vibes`: structured signals used for ranking and future embeddings.
- `profiles.profile_completeness`: percentage used to gate AI Picks until the profile has enough signal.
- `profiles.onboarding_source`: `manual | sample_autofill`; sample autofill is only for the current real user during development/testing.
- `profiles.ai_signals`: backend-owned matching signals such as embeddings, summary, processing timestamp, and version.
- `public_profiles`: safe read model for matching surfaces; excludes private auth/backend fields.
- `curated_matches.status`: `pending | accepted | declined | skipped | reported | matched`
- `curated_matches.pair_key`: sorted user IDs joined with `_`
- `matches.source`: `ai-curated`
- `conversations.match_id`: deterministic match id for the pair
- `conversation_participants`: participant gate for conversation/message RLS and unread counts.
- `reports`, `blocks`, `moderation_events`, `user_safety_actions`: safety and moderation audit surface.

## Profile Onboarding Model

The app no longer uses mock auth for the main flow. A user signs in with Supabase Auth, gets a real `profiles` row, then completes onboarding before AI Picks can run.

Onboarding collects:

- Basic profile: display name, age, campus, major, and avatar from Google/upload.
- Structured matching signals: interests, personality tags, dating goals, and preferred vibes.
- Natural-language context: optional bio plus quick answers such as weekend style, conversation style, memorable thing, and relationship intent.

The UI may offer `Autofill sample profile` for the current authenticated user to speed up development and demos. This writes normal profile fields to that real user's Supabase profile row and marks `onboarding_source: sample_autofill`. It does not switch the app into mock mode.

Backend AI processing should read the user-facing profile fields, generate embeddings/summaries, and write them only under `profiles.ai_signals` or related backend-owned tables. Users do not see embedding or generated-summary controls in the UI.

## Matching Lifecycle

1. User opens AI Picks.
2. App loads `daily_match_batches` and `curated_matches` through React Query.
3. If missing, Supabase Cloud Edge Function generates the batch.
4. User reviews each pick and submits feedback.
5. Accept records `accepted` but does not open chat yet.
6. When both users have accepted the same `pair_key`, server-side RPC creates `matches`, `conversations`, and `conversation_participants`.
7. Messages page shows the new conversation.

## Feedback Learning Lifecycle

Feedback is stored in `match_feedback` and summarized into `preference_profiles`. Accept feedback strengthens traits from the accepted candidate. Decline, skip, and report tags are stored as feedback summary signals. Preference chat updates the summary and soft preferences for future daily batches.

The current Edge Function fallback is deterministic and profile-based. Production AI should keep scoring, explanations, embeddings, safety checks, and preference learning behind Supabase Cloud Edge Functions.

AI matching should use:

- Self profile from the authenticated user's real `profiles` row.
- Candidate profiles from safe `public_profiles`. Early demo profiles can be seeded as normal Supabase users/profiles if the app has no real user pool yet.
- Structured profile fields for stable scoring and text fields/embeddings for semantic similarity.
- `preference_profiles` and `match_feedback` for learning from accept, decline, skip, report, and preference chat signals.

## Cleanup Notes

The old swipe UI and APIs should remain out of the active Expo app:

- no `Discovery` tab
- no `SwipeCard`
- no `MatchModal`
- no `swipeRight` or `swipeLeft`
- no new writes to `swipes`

Existing legacy `swipes` data can remain in Firebase until Phase 8 legacy removal is approved.
