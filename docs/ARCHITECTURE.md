# F-Love Architecture

## Product Model

F-Love is now an AI-curated dating app for FPT students. The core matching surface is `AI Picks`: each user receives a short daily batch of 3-5 recommended profiles, each with an explanation and compatibility signal. There is no swipe flow.

Official matches are created only after mutual accept. A curated recommendation is not a match; it becomes a match after both users accept the same pair. Messages are only available for official matches.

Blind Date remains a separate optional feature. It does not feed the AI-curated matching flow in v1.

## Frontend Modules

- `ai-picks`: daily curated recommendations, feedback controls, and preference chat.
- `messages`: direct conversations after mutual accept.
- `blind-date`: anonymous chat/reveal flow kept as a secondary feature.
- `profile`: real user profile, onboarding signals, bio/quick answers, interests, major, campus, and avatar.
- `auth`: FPT email login/signup and profile bootstrap.

The frontend uses Firebase Auth, Firestore, and Storage through `src/lib/firebase.ts`. AI provider calls must stay behind backend functions; the frontend only talks to app services.

## Services And Data Flow

- `curatedMatchService`
  - Reads or creates today's batch.
  - Reads `curatedMatches`.
  - Records accept/decline/skip/report feedback.
  - Creates official `matches` and `conversations` after mutual accept.
  - Uses local curation fallback when Firebase Functions are not enabled. The fallback reads real Firestore `users` as candidates and uses structured profile signals where available.

- `preferenceChatService`
  - Stores user preference chat messages.
  - Updates `preferenceProfiles` from chat hints.
  - Uses local fallback when Firebase Functions are not enabled.

- `aiBackendService`
  - Callable-function adapter for `generateDailyMatches`, `submitMatchFeedback`, `acceptCuratedMatch`, and `sendPreferenceChatMessage`.
  - Enabled only when `VITE_AI_MATCH_BACKEND=functions`.

## Firestore Shape

```text
users/{uid}
preferenceProfiles/{uid}
dailyMatchBatches/{uid_yyyy-mm-dd}
curatedMatches/{uid_yyyy-mm-dd_candidateUid}
matchFeedback/{feedbackId}
matches/{pairKey}
conversations/{conversation_pairKey}
conversations/{conversationId}/messages/{messageId}
preferenceChats/{uid}/messages/{messageId}
```

Important fields:

- `users.profileText`: user-facing text inputs for matching context (`bio`, `weekendStyle`, `conversationStyle`, `memorableThing`, `relationshipIntent`).
- `users.interests`, `users.personalityTags`, `users.datingGoals`, `users.preferredVibes`: structured signals used for ranking and future embeddings.
- `users.profileCompleteness`: percentage used to gate AI Picks until the profile has enough signal.
- `users.onboardingSource`: `manual | sample_autofill`; sample autofill is only for the current real user during development/testing.
- `users.aiSignals`: backend-owned matching signals such as embeddings, summary, processing timestamp, and version.
- `curatedMatches.status`: `pending | accepted | declined | skipped | reported | matched`
- `curatedMatches.pairKey`: sorted user IDs joined with `_`
- `matches.source`: `ai-curated`
- `conversations.matchId`: deterministic match id for the pair

## Profile Onboarding Model

The app no longer uses mock auth for the main flow. A user signs in with Firebase Auth, gets a real `users/{uid}` document, then completes onboarding before AI Picks can run.

Onboarding collects:

- Basic profile: display name, age, campus, major, and avatar from Google/upload.
- Structured matching signals: interests, personality tags, dating goals, and preferred vibes.
- Natural-language context: optional bio plus quick answers such as weekend style, conversation style, memorable thing, and relationship intent.

The UI may offer `Autofill sample profile` for the current authenticated user to speed up development and demos. This writes normal profile fields to that real user's Firestore document and marks `onboardingSource: sample_autofill`. It does not switch the app into mock mode.

Backend AI processing should read the user-facing profile fields, generate embeddings/summaries, and write them only under `users.aiSignals` or related backend-owned documents. Users do not see embedding or generated-summary controls in the UI.

## Matching Lifecycle

1. User opens AI Picks.
2. App loads `dailyMatchBatches/{uid_date}`.
3. If missing, backend function generates the batch. If functions are disabled, local fallback ranks users from Firestore profile data.
4. User reviews each pick and submits feedback.
5. Accept records `accepted` but does not open chat yet.
6. When both users have accepted the same `pairKey`, the app creates `matches/{pairKey}` and `conversations/{conversation_pairKey}`.
7. Messages page shows the new conversation.

## Feedback Learning Lifecycle

Feedback is stored in `matchFeedback` and summarized into `preferenceProfiles/{uid}`. Accept feedback strengthens traits from the accepted candidate. Decline, skip, and report tags are stored as feedback summary signals. Preference chat updates the summary and soft preferences for future daily batches.

The current fallback is deterministic and profile-based. Production AI should move scoring, explanations, embeddings, safety checks, and preference learning into Firebase Functions.

AI matching should use:

- Self profile from the authenticated user's real Firestore document.
- Candidate profiles from other real `users` documents in Firestore. Early demo profiles can be seeded as normal user documents if the app has no real user pool yet.
- Structured profile fields for stable scoring and text fields/embeddings for semantic similarity.
- `preferenceProfiles` and `matchFeedback` for learning from accept, decline, skip, report, and preference chat signals.

## Cleanup Notes

The old swipe UI and APIs were removed from the active app:

- no `Discovery` tab
- no `SwipeCard`
- no `MatchModal`
- no `swipeRight` or `swipeLeft`
- no new writes to `swipes`

Existing legacy `swipes` data can remain in Firestore until a separate data cleanup is approved.
