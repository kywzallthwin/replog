# STATUS.md

## Current Phase
- Client profile/account UI wired / browser smoke test next

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
- Backend auth routes now exist under `/auth` for register, login, current user, and logout
- Auth uses bcrypt password hashing, JWT in an `httpOnly` cookie, Zod request validation, and Prisma user persistence
- Server env validation now reads `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, and `PORT`
- `client/src/lib/api.ts` now targets `http://localhost:4000` with credentials enabled
- `client/src/pages/LoginPage.tsx` now submits to `/auth/login`, shows loading/errors, and redirects to `/dashboard` on success
- `client/src/pages/RegisterPage.tsx` now submits to `/auth/register`, shows loading/errors, and redirects to `/dashboard` on success
- `client/src/pages/DashboardPage.tsx` now provides a temporary `/dashboard` destination for successful auth redirects
- Client `/dashboard` is now protected by a React Query `/auth/me` bootstrap guard
- `client/src/pages/DashboardPage.tsx` now includes logout UI that calls `/auth/logout`, clears the auth query cache, and redirects to `/login`
- Client `/login` and `/register` are now guest-only routes that redirect authenticated users to `/dashboard`
- Login and register success handlers now cache the returned auth user for the `/auth/me` query key before redirecting
- Existing email/password auth API flow was smoke tested with a live server: register, `/auth/me`, logout, post-logout 401, login, and `/auth/me` after login all passed
- Backend user account routes now exist under `/users`: `PATCH /users/me` for username/email updates and `POST /users/me/password` for password changes
- User account routes are protected by the existing JWT cookie auth middleware, validate request bodies with Zod, check email conflicts, and use bcrypt for password verification/hashing
- New account-route smoke tests passed for unauthenticated 401, profile update persistence, wrong-current-password 401, password-change 204, old-password login rejection, and new-password login success
- Client account helpers now include `updateCurrentUser()` and `changePassword()` in `client/src/lib/auth.ts`
- Protected client account routes now exist for `/profile`, `/profile/edit`, and `/profile/password`
- Dashboard now links the user chip/avatar to `/profile`
- `client/src/pages/ChangePasswordPage.tsx` now uses a real inline lock icon instead of the temporary `*` placeholder
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
- Added backend email/password auth routes and verified register, login, `/auth/me`, logout, and post-logout 401 behavior
- Wired the client login form to the backend auth endpoint and verified the client build succeeds
- Added a temporary `/dashboard` route and verified the client build succeeds
- Wired the client register form to the backend auth endpoint and verified the client build succeeds
- Added client `/auth/me` bootstrap for protected `/dashboard` routing and verified the client build succeeds
- Added dashboard logout UI/client handling and verified the client build succeeds
- Added guest-only route guarding for `/login` and `/register` and verified the client build succeeds
- Added backend profile and password-management routes and verified them with live API smoke tests
- Added protected client profile, edit-profile, and change-password pages wired to the account endpoints and verified the client build succeeds
- Polished the change-password page lock icon and verified the client build succeeds

## Next Actions
1. Manually smoke test browser register/login/logout redirects with both workspaces running.
2. Manually smoke test profile edit and password-change pages from the browser.
3. Manually smoke test authenticated users are redirected from `/login` and `/register` to `/dashboard` and unauthenticated users are blocked from `/profile` routes.
4. Add Google OAuth after the email/password auth and account-management flow is verified end-to-end.

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
- 2026-06-08: Added server env validation, a shared Prisma client, and `/auth/register`, `/auth/login`, `/auth/me`, and `/auth/logout`. Verified `npm exec -w server -- tsc --noEmit`, `npm exec -w server -- prisma validate`, `npm exec -w server -- prisma generate`, `npm exec -w server -- prisma db seed`, and live auth smoke tests for register/login/me/logout.
- 2026-06-08: Recreated missing untracked auth source files under `server/src/` after confirming `index.ts` still imported them. Re-verified `npm exec -w server -- tsc --noEmit`, `npm exec -w server -- prisma validate`, `npm exec -w server -- prisma generate`, and live auth smoke tests for register/login/me/logout.
- 2026-06-15: Wired `client/src/pages/LoginPage.tsx` with controlled email/password fields, `/auth/login` submit handling, loading/error states, and a success redirect to `/dashboard`. Verified with `npm run build -w client`. The next resume step is to add a valid `/dashboard` destination, then wire register and `/auth/me` bootstrap.
- 2026-06-15: Added `client/src/pages/DashboardPage.tsx` and registered `/dashboard` in `client/src/router.tsx` so successful login has a valid destination. Verified with `npm run build -w client`. The next resume step is to wire `RegisterPage.tsx` to `/auth/register`.
- 2026-06-15: Wired `client/src/pages/RegisterPage.tsx` with controlled username/email/password fields, `/auth/register` submit handling, loading/error states, and a success redirect to `/dashboard`. Verified with `npm run build -w client`. The next resume step is to add `/auth/me` bootstrap/protected route behavior.
- 2026-06-15: Added `client/src/lib/auth.ts` and `client/src/components/auth/RequireAuth.tsx`, then wrapped `/dashboard` with the guard so it checks `/auth/me` before rendering and redirects unauthenticated users to `/login`. Verified with `npm run build -w client`. The next resume step is a browser smoke test with both workspaces running, then logout UI/client handling.
- 2026-06-17: Added `logoutUser()` in `client/src/lib/auth.ts` and a logout button in `client/src/pages/DashboardPage.tsx`. Logout calls `/auth/logout`, removes the cached `/auth/me` query, and redirects to `/login`. Verified with `npm run build -w client`. The next resume step is browser smoke testing login/register/logout with both workspaces running.
- 2026-06-17: Added `client/src/components/auth/GuestOnly.tsx`, wrapped `/login` and `/register`, and updated login/register success handlers to cache the returned user under `authMeQueryKey` before redirecting. Verified with `npm run build -w client`. The next resume step is browser smoke testing the full auth route behavior.
- 2026-06-17: Smoke tested the existing auth API flow with a live server, then added `server/src/modules/users/users.routes.ts` and `server/src/modules/users/users.schemas.ts`. Mounted `/users` in `server/src/index.ts`. Verified `npm exec -w server -- tsc --noEmit`, `npm run build -w client`, `npm exec -w server -- prisma validate`, and live account-route smoke tests for profile update and password change.
- 2026-06-17: Added client profile/account UI: `/profile`, `/profile/edit`, `/profile/password`, account API helpers in `client/src/lib/auth.ts`, protected router entries, and a dashboard profile chip link. Verified `npm run build -w client` and `npm exec -w server -- tsc --noEmit`. Next resume step is browser smoke testing the account flow with both workspaces running.
- 2026-06-17: Replaced the temporary `*` placeholder on `/profile/password` with an inline lock SVG matching the mockup intent. Verified with `npm run build -w client`.
