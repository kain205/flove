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

- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Firebase Auth, Firestore, Storage
- Capacitor Android
- i18next

## Architecture

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the product model, frontend modules, Firestore shape, matching lifecycle, feedback learning lifecycle, and cleanup notes.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npx tsc --noEmit
npm run build
```

## AI Backend Mode

The app includes a callable-functions adapter behind `aiBackendService`. By default, it uses the local Firestore fallback so the app can run without deployed functions.

Set this when Firebase Functions are deployed:

```bash
VITE_AI_MATCH_BACKEND=functions
```

Expected callable function names:

- `generateDailyMatches`
- `submitMatchFeedback`
- `acceptCuratedMatch`
- `sendPreferenceChatMessage`
