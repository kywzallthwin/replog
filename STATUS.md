# STATUS.md

## Current Phase
- Prisma migration and seed path complete / backend auth next

## Last Confirmed State
- Project name chosen: `RepLog`
- Repo root in use: `D:\coding\project\workout`
- Mockup reference confirmed: `atomic-moore-mockup/atomic-moore-mockup.html`
- Build plan confirmed: `AtomicMoore-Build-Plan.pdf`
- Root npm workspace config already exists in `package.json`
- Declared workspaces in root config: `client`, `server`
- `client/` now exists with a Vite React + TypeScript scaffold
- `server/` now exists as an npm workspace with an Express + TypeScript scaffold
- Root `package-lock.json` and `node_modules/` already exist
- Tailwind v4 is wired into `client/` via the Vite plugin and global CSS import
- Tailwind v4 is the chosen path; do not use the older `tailwindcss init -p` flow from the PDF
- `client/src/App.tsx` now renders the first real mockup-based screen as a static Tailwind login view
- The old starter `App.css` import is gone, and the starter CSS/assets were removed from `client/src/`
- Client dependencies now include `react-router-dom`, `@tanstack/react-query`, and `axios`
- Client routing now redirects `/` to `/login` and serves separate `/login` and `/register` auth pages
- Client shared scaffolding now includes `src/router.tsx`, `src/lib/api.ts`, and `src/lib/queryClient.ts`
- Server dependencies now include `express`, `cors`, `cookie-parser`, `zod`, `jsonwebtoken`, and `bcryptjs`
- Server dev tooling now includes `typescript`, `tsx`, and the initial `server/tsconfig.json`
- `server/src/index.ts` now boots a minimal Express app with a `/health` route
- `npm run dev -w server` was verified via `http://localhost:4000/health`
- Prisma is now initialized in `server/` with `server/prisma/schema.prisma`, `server/prisma.config.ts`, and `server/.env`
- `server/prisma/schema.prisma` now defines the full initial MVP data model and passes `npm exec -w server -- prisma validate`
- The first Prisma migration exists under `server/prisma/migrations/`
- Prisma seed wiring is configured in `server/prisma.config.ts` and implemented in `server/prisma/seed.ts`
- `server/prisma/seed.ts` creates a demo user, 17 global exercises, and the 5-day example routine structure
- `npm exec -w server -- prisma generate` and `npm exec -w server -- prisma db seed` were verified
- Last verified Node version: `v25.6.1`

## Completed
- Chose project name: `RepLog`
- Confirmed repo root and reference files
- Confirmed root workspace setup is partially in place
- Created persistent handoff docs: `AGENTS.md` and `STATUS.md`
- Scaffolded the Vite React + TypeScript client in `client/`
- Wired Tailwind v4 into the Vite client and verified the client build succeeds
- Replaced the default Vite starter screen with a static Tailwind login screen in `client/src/App.tsx`
- Installed `react-router-dom`, `@tanstack/react-query`, and `axios` in `client/` and verified the client build still succeeds
- Added client routing with `/login` and `/register`, plus `src/lib/api.ts` and `src/lib/queryClient.ts`, and verified the client build still succeeds
- Scaffolded the `server/` workspace with Express + TypeScript, added `server/src/index.ts`, and verified the server via `/health`
- Initialized Prisma + SQLite in `server/` and wrote the full first MVP schema with validation passing
- Ran the first Prisma migration, generated the Prisma client, and added a verified seed path for demo starter data

## Next Actions
1. Start the auth backend flow with environment scaffolding, shared Prisma client setup, and the initial `/auth` routes.
2. Connect the client auth forms to the backend flow and protected auth bootstrap.
3. Add profile and password-management backend routes after email/password auth works.
4. Add Google OAuth after the email/password auth flow is verified end-to-end.

## Open Questions
- None recorded right now.

## Blockers
- None.

## Session Notes
- 2026-06-04: Added `AGENTS.md` for stable repo instructions and `STATUS.md` for session-to-session handoff. Current immediate next step was Step 0.
- 2026-06-05: Reconciled the checkpoint after detecting that `client/` had already been scaffolded with Vite. The next implementation step is Tailwind setup in the client.
- 2026-06-05: Wired Tailwind v4 into the client by adding the Vite plugin and replacing `client/src/index.css` with the Tailwind import. Verified with `npm run build -w client`.
- 2026-06-05: Confirmed Tailwind v4 is the chosen approach instead of the older PDF `init -p` flow. The next resume step is to replace the Vite starter `App.tsx` and stop importing `App.css`.
- 2026-06-05: Rebuilt `client/src/App.tsx` from scratch as a static Tailwind login screen based on the mockup after the starter file was cleared. Verified again with `npm run build -w client`.
- 2026-06-06: Installed the Step 3 client libraries (`react-router-dom`, `@tanstack/react-query`, `axios`) and re-verified the client with `npm run build -w client`. The next resume step is to commit the dependency checkpoint, then introduce routing and split `/login` and `/register` into separate pages.
- 2026-06-06: Added `client/src/router.tsx`, `client/src/lib/api.ts`, and `client/src/lib/queryClient.ts`, split the auth UI into separate `/login` and `/register` pages, and re-verified the client with `npm run build -w client`. The next resume step is to commit this client checkpoint, then scaffold `server/`.
- 2026-06-07: Scaffolded `server/` as an npm workspace, installed the initial Express + TypeScript dependencies, added `server/src/index.ts` and `server/tsconfig.json`, and verified `npm run dev -w server` via `http://localhost:4000/health`. The next resume step is to commit this checkpoint, then add Prisma + SQLite.
- 2026-06-07: Reconciled `STATUS.md` after confirming the server scaffold commit already exists. The next resume step is now Prisma + SQLite, followed by the initial schema, seed path, and auth routes.
- 2026-06-07: Initialized Prisma + SQLite in `server/`, wrote the full first MVP schema in `server/prisma/schema.prisma`, and verified it with `npm exec -w server -- prisma validate`. The next resume step is to run the first migration, then add the initial seed path.
- 2026-06-07: Confirmed the first migration exists, added Prisma seed wiring/data, installed `@prisma/adapter-better-sqlite3` and `dotenv`, generated the Prisma client, and verified `npm exec -w server -- prisma db seed` twice. The next resume step is backend auth scaffolding.
