# Agent Rules

- Always read `docs/ARCHITECTURE.md` before making architecture-affecting changes.
- Treat `docs/ARCHITECTURE.md` as the single source of truth for Flove architecture.
- Update `docs/ARCHITECTURE.md` in the same PR/commit when changing Supabase schema/migrations/RLS, Edge Functions, environment variables, deployment scripts, package boundaries, Expo routing/navigation, auth/realtime/storage patterns, or Firebase/Capacitor removal status.
- Do not duplicate the full architecture here; link back to `docs/ARCHITECTURE.md`.
- Never commit secrets, `.env` files, service-role keys, OpenAI keys, DB passwords, JWT secrets, or Supabase CLI temp metadata.
- Prefer the Supabase Cloud + Expo React Native architecture unless the user explicitly requests otherwise.
- Run relevant validation commands before reporting done, using the actual scripts in `package.json` and `apps/app/package.json`.
- Summarize documentation changes and commands run in the final response.

## Commit behavior

- After completing an implementation task, run relevant verification commands, then create a git commit automatically unless the user explicitly says not to commit, asks for planning/review only, or the task is incomplete.
- Commit only files changed for the completed task. Preserve unrelated user changes and generated files from other work.
- If unrelated changes overlap with files needed for the task, inspect them first and ask only when the boundary is unclear.
