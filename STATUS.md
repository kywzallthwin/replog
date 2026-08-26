# RepLog Status

## Current Phase
- Production readiness, Phase 1: CI safety net (complete).
- Multiple-program MVP acceptance is complete; PostgreSQL migration is the next phase.

## Confirmed State
- Root workspace: `D:\coding\project\workout`
- Workspaces: `client`, `server`
- Client: Vite + React + TypeScript + Tailwind v4 + React Router + TanStack Query + Axios
- Server: Express + TypeScript + Prisma + SQLite + Zod
- Multiple-program migrations remain SQLite-specific and are intentionally unchanged in Phase 1.
- Generated Prisma Client remains ignored and is regenerated during installation/build/CI.

## Completed Features
- Email/password authentication, Google OAuth, HTTP-only cookie auth, and password recovery.
- Dashboard, active workouts, persistent timer, history, progress, profile, and custom exercises.
- Program creation from templates, blank routines, and copies.
- Program rename, editing, activation, protected deletion, ownership checks, and workout snapshots.
- Beginner Full Body, Upper / Lower, Push / Pull / Legs, and Example Program templates.
- Exercise swap safety, set validation, duration/numbering fixes, and neutral progress language.

## Multiple-Program Acceptance
- Browser acceptance passed at 375px, 430px, and desktop widths.
- Creation, copying, editing, activation, deletion, edge-positioned menus, and Copy from passed.
- Switching was blocked during an active workout.
- History retained the original program snapshot after switching programs.

## Phase 1 CI Safety Net
- Node `24.19.0` and npm `11.9.0` are pinned.
- Root lint and typecheck cover both workspaces; client typecheck is explicit.
- Server linting, Prisma validation, clean migration checks, isolated automatic test discovery, and compiled `/health` smoke testing are wired.
- GitHub Actions is configured for pushes and pull requests without credentials.

## Verification
- `npm run check` passes on Node `v24.19.0` and npm `11.9.0` as of 2026-08-26.
- Prisma generation and validation, workspace lint, workspace typecheck, tests, build, compiled `/health`, and `git diff --check` pass.
- Tests automatically discover both `programs.test.ts` and `sessions.test.ts`, apply all 11 migrations to a temporary SQLite database, and pass serially.
- `server/dev.db` length and modification time were unchanged across the isolated test run.
- The first local `npm run check` attempt exceeded a 120-second shell timeout during client lint; a 300-second rerun completed successfully. CI has a 15-minute job timeout.
- The client build reports the existing Vite warning that the main JavaScript chunk is larger than 500 kB.
- `npm audit --omit=dev` reports 13 vulnerabilities in the existing production dependency tree; no automatic audit fix was applied.

## Next Actions
- Begin Phase 2 by discarding local SQLite data and creating a fresh PostgreSQL database.
- Later configure `/api`, Express static serving, Railway, Google OAuth, and Resend for launch.

## Deferred Backlog
- `/guide`, rest timer enhancements, last-time references, workout notes, unit preferences, SVG chart, and day reordering.

## Production Decisions
- One public origin and one Node web service.
- Express will serve the Vite production build.
- Railway managed PostgreSQL is the deployment target.
- Google OAuth and Resend are required for launch.
- Ignored environment files and credentials must never be committed.

## Blockers
- No Phase 1 implementation blockers recorded.
