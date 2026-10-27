# RepLog — Claude Code Rules

RepLog is a mobile-first workout tracker: `client/` (React + Vite + Tailwind),
`server/` (Express + Prisma + PostgreSQL), `edge/` (Cloudflare Worker proxy).
Commands are in the root `package.json`.

## Working directory
- Edit files directly in the current checkout and current branch.
- Never create or enter a git worktree. Do not use subagents.
- Do not switch, create, or delete branches unless asked.

## Small tasks (default)
Unless the prompt says "ticket work", treat the request as a small bounded change:
- Do NOT read or update `STATUS.md`, `ROADMAP.md`, `WAVE2.md`, or `tickets/`.
- Only touch the files the prompt names. If another file must change, say so first.
- Use targeted search and line ranges; do not open large files whole
  (e.g. `WorkoutPage.tsx`, `ExercisePickerDialog.tsx`, `sessions.routes.ts`).
- Verify with only the related tests plus lint/typecheck of the touched workspace.
- Do NOT run `npm run check` — the user runs it before merging.
- Do NOT fix unrelated failing tests; report them instead.
- If stuck on the same failure twice, stop and report what is failing.
- When done, stop and report: files changed and check results.

## Ticket work (only when the prompt says so)
Follow `AGENTS.md`: read `STATUS.md` and the active ticket, run the full ticket check once.

## Always
- Mobile-first: 375px is the primary width; touch targets at least 44px.
- Keep the existing styling and the mockup's structure.
- Preserve unrelated changes; do not revert or reformat other files.
- Never commit, push, deploy, or change production config without explicit permission.
- Never commit `.env` files or secrets.
