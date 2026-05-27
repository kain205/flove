# F-Love Architecture

## Product Model

F-Love is now an AI-curated dating app for FPT students. The core matching surface is `AI Picks`: each user receives a short daily batch of 3-5 recommended profiles, each with an explanation and compatibility signal. There is no swipe flow.

Official matches are created only after mutual accept. A curated recommendation is not a match; it becomes a match after both users accept the same pair. Messages are only available for official matches.

Blind Date remains a separate optional feature. It does not feed the AI-curated matching flow in v1.

## Frontend Modules

- `ai-picks`: daily curated recommendations, feedback controls, and preference chat.
- `messages`: direct conversations after mutual accept.
- `blind-date`: anonymous chat/reveal flow kept as a secondary feature.
- `profile`: user profile, bio, interests, major, campus, and avatar.
- `auth`: FPT email login/signup and profile bootstrap.

The frontend uses Firebase Auth, Firestore, and Storage through `src/lib/firebase.ts`. AI provider calls must stay behind backend functions; the frontend only talks to app services.

## Services And Data Flow

- `curatedMatchService`
  - Reads or creates today's batch.
  - Reads `curatedMatches`.
  - Records accept/decline/skip/report feedback.
  - Creates official `matches` and `conversations` after mutual accept.
  - Uses local curation fallback when Firebase Functions are not enabled.

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

- `curatedMatches.status`: `pending | accepted | declined | skipped | reported | matched`
- `curatedMatches.pairKey`: sorted user IDs joined with `_`
- `matches.source`: `ai-curated`
- `conversations.matchId`: deterministic match id for the pair

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

The current fallback is deterministic and profile-based. Production AI should move scoring, explanations, safety checks, and preference learning into Firebase Functions.

## Cleanup Notes

The old swipe UI and APIs were removed from the active app:

- no `Discovery` tab
- no `SwipeCard`
- no `MatchModal`
- no `swipeRight` or `swipeLeft`
- no new writes to `swipes`

Existing legacy `swipes` data can remain in Firestore until a separate data cleanup is approved.
