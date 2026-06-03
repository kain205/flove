# Agent Rules

## Commit behavior

- After completing an implementation task, run the relevant verification commands, then create a git commit automatically.
- Commit only the files changed for the completed task. Do not stage unrelated user changes or generated files from other work.
- Do not auto-commit when the user explicitly says not to commit, asks for planning/review only, or the task is incomplete.
- If unrelated changes overlap with the files needed for the task, inspect them first and preserve them. Ask before committing only when the boundary between user changes and agent changes is unclear.
- Use concise conventional commit-style messages when possible, for example `feat: add route-driven navigation` or `fix: sanitize profile save payload`.
