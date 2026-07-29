# STATUS.md

## Current Phase
- `/program` routine editor backend + client are built and API-verified; visual UI spot-check still pending (see Next Actions) / History, progress, and active-workout exercise management backend logic previously verified via API-level smoke test / `/guide` is explicitly skipped (see Backlog) / remaining mockup-rewrite backlog items are unscheduled

## Last Confirmed State
- Project name chosen: `RepLog`
- Repo root in use: `D:\coding\project\workout`
- Mockup reference confirmed: `Replog-mockup/Replog-mockup.html`
- Build plan confirmed: `Replog-Build-Plan.pdf`
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
- `client/src/pages/ChangePasswordPage.tsx` now includes Show/Hide controls for all password fields
- Password Show/Hide controls keep the focused input cursor in place after toggling visibility
- Backend dashboard route now exists at `GET /dashboard`, protected by cookie auth, and returns active starter program days, suggested day, recent sessions, and stats
- New registered users now receive the 5-day starter program automatically through shared starter-program creation logic
- Client dashboard now loads real `/dashboard` data, shows suggested day, routine day pills, recent sessions, and stats
- Backend sessions routes now exist under `/sessions`: `POST /sessions` starts a session from a day and snapshots day/exercise names, `GET /sessions/:sessionId` loads the session shell
- Client session helpers now exist in `client/src/lib/sessions.ts`
- Protected `/workout/:sessionId` client route now exists and displays the active workout shell with session exercises
- Dashboard `Start Workout` and day pills now create a session and redirect to `/workout/:sessionId`
- Starter program and seed day badge values match the mockup palette, but dashboard day labels now render with neutral styling
- Dashboard day-picker pills and recent-session day labels now use neutral styling instead of color-coded badges
- Backend set logging now exists at `POST /sessions/:sessionId/exercises/:sessionExerciseId/sets`, protected by cookie auth and scoped to the authenticated user's session
- Add-set validation accepts `kind` (`WARMUP`, `NORMAL`, `DROP`), `weightKg`, and `reps`; the server auto-assigns the next set order
- Backend set edit/delete now exists at `PATCH /sessions/:sessionId/exercises/:sessionExerciseId/sets/:setId` and `DELETE /sessions/:sessionId/exercises/:sessionExerciseId/sets/:setId`, protected by cookie auth and scoped to the authenticated user's session
- Set mutations now reject finished sessions, and set delete renumbers later sets for that exercise to keep order contiguous
- Client `client/src/lib/sessions.ts` now includes `addSet()`, `updateSet()`, `deleteSet()`, and `finishSession()`
- `client/src/pages/WorkoutPage.tsx` now opens an inline Add Set form per exercise, displays logged sets, and refreshes the session query after saving
- `client/src/pages/WorkoutPage.tsx` now includes inline set edit/delete and a page-level finish-workout action, all wired to the API and protected from mutation if the workout is already finished
- Dashboard recent-session cards now link to `/workout/:sessionId` so an in-progress session can be reopened
- Dashboard recent-session cards now label completed workouts as `Finished · Duration: X min` while active workouts still show `In progress`
- Client API base URL is configurable with `VITE_API_URL`; use `client/.env.example` plus `server/.env.example` as references for same-Wi-Fi mobile testing
- Browser smoke tests passed for auth redirects, dashboard/workout flow, full set/session lifecycle, and account pages
- Backend history endpoint now exists at `GET /sessions/history`, protected by cookie auth, and returns finished sessions with exercise/set counts
- Client `/history` route now exists and displays finished workouts grouped by month, with cards linking to the existing read-only workout detail
- Dashboard Recent Sessions now links to `/history` through a `View all` action
- Workout detail header navigation now respects `?from=dashboard` and `?from=history`, defaulting to Dashboard for direct links
- `server/package.json` now includes `typecheck`, so server verification can use `npm run typecheck -w server`
- Backend progress endpoint now exists at `GET /progress`, protected by cookie auth, and returns finished-session exercise options, estimated 1RM personal best, top-set history, and trend stats
- Progress strength metrics use finished-session `NORMAL` sets only; warm-up and drop sets are excluded from the estimated 1RM PB calculation
- Client `/progress` route now exists with an exercise selector, estimated-1RM personal-best card, stats cards, session-history table, trend row, and dashboard stats link
- Backend exercise lookup now exists at `GET /exercises`, protected by cookie auth, returning global exercises plus user-owned exercises grouped client-side by category
- Backend active-session exercise mutation routes now exist under `/sessions`: `POST /sessions/:sessionId/exercises`, `PATCH /sessions/:sessionId/exercises/:sessionExerciseId`, and `DELETE /sessions/:sessionId/exercises/:sessionExerciseId`
- Session exercise mutations are scoped to the authenticated user's session, reject finished workouts, validate target exercises, append new exercises at the next order, swap exercise snapshots, and remove exercises with their set logs while renumbering later exercises
- Client exercise helpers now exist in `client/src/lib/exercises.ts`, and session exercise helpers now exist in `client/src/lib/sessions.ts`
- `client/src/pages/WorkoutPage.tsx` now shows active-workout `Swap`, remove, and `+ Add Exercise` controls with a searchable category-grouped picker modal; completed workouts remain read-only
- Workout exercise card actions now keep the remove exercise button as the rightmost action
- Workout set delete and exercise remove confirmations now use an in-app confirmation modal instead of browser `window.confirm` popups
- Client now has a persistent navigation shell: `client/src/components/nav/navItems.ts`, `BottomTabBar.tsx` (fixed, mobile-only, `sm:hidden`), and `TopNav.tsx` (inline, desktop-only, `hidden sm:flex`)
- `/dashboard`, `/history`, `/progress`, and `/profile` all render `<TopNav />` inline in their existing headers and `<BottomTabBar />` before their closing `<main>`; `/workout/:sessionId`, `/profile/edit`, `/profile/password`, `/login`, and `/register` intentionally do not
- Persistent nav omits a Program tab/item for now since `/program` doesn't exist yet; `NAV_ITEMS` in `navItems.ts` is a plain array so Program can be added later with no component changes
- Fixed a pre-existing bug on `/progress`: the header's `Dashboard` back-link had `to="\dashboard"` (backslash) instead of `to="/dashboard"` and never navigated
- Backend routine-editor routes now exist under `/programs`: `GET /programs/active` (auto-provisions the starter program, returns the full Program → Day → DayExercise tree), `POST /programs/active/days`, `PATCH`/`DELETE /programs/days/:dayId`, `POST /programs/days/:dayId/exercises`, `DELETE /programs/days/:dayId/exercises/:dayExerciseId`, and `PATCH /programs/days/:dayId/exercises/:dayExerciseId/reorder`
- Day `badgeColor` is now a closed 8-color enum (`DAY_BADGE_COLORS`, in both `server/src/modules/programs/programs.schemas.ts` and `client/src/lib/programs.ts`) instead of a free-text string, since it became user-writable for the first time; the 3 new colors (purple/rose/teal) supplement the 5 existing seed colors
- Day/day-exercise deletes renumber remaining siblings contiguously (same transaction pattern as session-exercise/set delete); day-exercise reorder is an adjacent ↑/↓ swap using a transient sentinel order to avoid colliding with SQLite's immediate unique-constraint check
- Deleting a Day correctly leaves past `Session` rows intact (dayId set to null via `SetNull`, but `dayNameSnapshot`/`badgeColorSnapshot` untouched) — verified explicitly by smoke test
- Day reordering (whole days, not exercises within a day) is intentionally out of scope for this pass — no backlog/mockup support for it yet
- Extracted `getBadgeClass()` out of `HistoryPage.tsx` into shared `client/src/lib/badgeColors.ts` (now covering all 8 colors); `HistoryPage.tsx` imports it instead of keeping its own copy
- New `client/src/lib/programs.ts` provides typed API helpers (`getActiveProgram`, `addDay`, `updateDay`, `deleteDay`, `addDayExercise`, `removeDayExercise`, `reorderDayExercise`) mirroring `lib/sessions.ts` conventions
- New protected `/program` route and `client/src/pages/ProgramPage.tsx` let a user add/rename/recolor/delete Days and add/remove/reorder exercises within a Day; day delete lives inside the pencil edit-day modal rather than as a separate card icon; exercise picker and delete-confirmation modals are duplicated locally from `WorkoutPage.tsx`'s pattern (not extracted into shared components) to avoid risking that already-verified page
- `client/src/components/nav/navItems.ts` now includes a Program tab (`◎`) between Progress and Profile, picked up automatically by both `BottomTabBar` and `TopNav` with no component changes
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
- Added Show/Hide controls to the change-password form fields
- Kept the change-password input cursor focused after clicking Show/Hide controls
- Added seeded dashboard data flow and verified the client build, server typecheck, and live dashboard API smoke test
- Added start-workout session creation/detail flow and verified the client build, server typecheck, and live session API smoke test
- Aligned starter routine badge colors and dashboard pill styling with the mockup, then verified the client build and server typecheck
- Added active-workout set logging and verified the client build, server typecheck, and live add-set API smoke test
- Made dashboard recent sessions reopen the workout route and verified the client build/server typecheck
- Added backend set edit/delete routes and verified the server typecheck plus live add/patch/delete/order smoke test on port 4001
- Added client set/session mutation helpers and the full workout page UI for adding, editing, deleting, and finishing a workout
- Added environment examples and configurable client API base URL for mobile LAN testing; verified the client build succeeds
- Updated dashboard recent-session labels so completed workouts explicitly show finished status and duration
- Browser smoke tested auth redirects, dashboard/workout flow, full set/session lifecycle, and account pages successfully
- Added the first History implementation with a backend finished-session list endpoint, typed client helper, protected `/history` page, and dashboard link; verified the client build and server typecheck
- Added a server `typecheck` script and verified it with `npm run typecheck -w server`
- Updated workout detail navigation so dashboard-opened sessions link back to `/dashboard`, history-opened sessions link back to `/history`, and direct links default to Dashboard; verified with `npm run build -w client`
- Added the first Progress implementation with a backend finished-set analytics endpoint, typed client helper, protected `/progress` page, and dashboard link; verified with `npm run build -w client` and `npm exec -w server -- tsc --noEmit`
- Updated Progress personal best to use Epley estimated 1RM from finished-session `NORMAL` sets, with heaviest set as a secondary stat; verified with `npm run build -w client` and `npm run typecheck -w server`
- Added active-workout exercise lookup plus add/swap/remove session exercise flows in the backend and workout UI; verified with `npm run build -w client` and `npm run typecheck -w server`
- Moved the active-workout remove exercise button to the rightmost action position and verified with `npm run build -w client`
- Replaced workout delete browser popups with a shared in-app confirmation modal for deleting sets and removing exercises; verified with `npm run build -w client`
- Verified `/history`, `/progress`, and active-workout exercise management backend logic end-to-end with a 32-assertion Node/fetch API smoke test script against a disposable test account (registration, empty states, add/swap/remove exercise with order renumbering, finished-session mutation blocking, Epley 1RM personal best matching `TODO.md`'s worked example, and a 2-point progress trend across two finished sessions) — all 32 assertions passed
- Added the persistent navigation shell (Backlog item) from the mockup redesign: new `client/src/components/nav/` (`navItems.ts`, `BottomTabBar.tsx`, `TopNav.tsx`) wired into `/dashboard`, `/history`, `/progress`, `/profile`; fixed the `/progress` back-link typo along the way; verified with `npm run build -w client`
- Added the `/program` routine editor (Backlog item): backend `server/src/modules/programs/programs.routes.ts` + `programs.schemas.ts` mounted at `/programs`; client `lib/programs.ts`, `pages/ProgramPage.tsx`, shared `lib/badgeColors.ts` (extracted from `HistoryPage.tsx`); registered `/program` in the router and added a Program nav tab. Verified with `npm exec -w server -- prisma validate`, `npm run typecheck -w server`, `npm run build -w client`, and a 39-assertion Node/fetch API smoke test (`smoke-test-programs.mjs`, not committed) against disposable accounts on a temporary port-4001 server — including day delete correctly preserving past session snapshot data and ownership scoping between two test users

## Next Actions
1. [x] `/history` backend logic verified via API smoke test (empty state for a new account, finished session appears with correct exercise/set counts). Visual-only checks (grouped-by-month display, card links to read-only `/workout/:sessionId`) were not covered by the API test and are still open for a manual browser spot-check whenever convenient.
2. [x] `/progress` backend logic verified via API smoke test (empty state for a new account; estimated 1RM personal best via Epley formula against `TODO.md`'s worked example; progress/heaviest-set/session-count stats; e1RM trend row growing to 2 points across two finished sessions). Visual-only checks (exercise selector UI, source top-set link, table rendering) were not covered and are still open for a manual browser spot-check.
3. [x] Active-workout exercise management backend logic verified via API smoke test: add exercise, swap exercise, remove with no logged sets, remove with logged sets, exercise-order renumbering after each removal, finished-session mutation blocking (add/swap/remove/add-set all correctly return 409), and history/progress correctly reflect a session that had exercises added/swapped/removed mid-workout. Visual-only checks (search/category picker UI, in-app confirmation modal) were not covered and are still open for a manual browser spot-check.
4. [x] Skipped for now, per explicit user decision — see Backlog. Building `/guide` is no longer part of the active build sequence.
5. [ ] Optional: manual browser spot-check of the visual-only items noted in 1-3 above (empty-state copy, month grouping, exercise-picker/confirmation-modal UI) — not blocking, backend correctness is already verified.
6. [ ] Manual browser spot-check of the new persistent navigation shell (bottom tab bar on mobile, top nav on desktop) across `/dashboard`, `/history`, `/progress`, `/profile` — confirm active-item highlighting, correct navigation, no content obscured by the fixed bottom bar, and that the `/progress` back-link fix actually navigates now.
7. [ ] Manual browser spot-check of the new `/program` routine editor — add/rename/recolor/delete a day (including the Delete Day button inside the edit modal), add/remove/reorder exercises within a day (confirm ↑/↓ disable correctly at list ends), confirm Dashboard's day pills/exercise counts update after Program edits, and confirm the Program tab highlights correctly in both the bottom tab bar and top nav. Backend logic is already verified via API smoke test.

## Backlog (from mockup design-spec rewrite, not yet planned)
- `Replog-mockup/Replog-mockup.html` was rewritten as a forward-looking design spec (its own note says so) and now specs several features not yet built. Not scheduled yet — capture only, to be turned into real Next Actions in a future session:
  - Persistent navigation: DONE for Dashboard/History/Progress/Profile/Program (see Completed).
  - `/forgot-password` and `/reset-password` routes.
  - `/program` route: DONE for day add/rename/recolor/delete and exercise add/remove/reorder within a day (see Completed). Still open/deferred: whole-day reordering (no backlog/mockup support for it yet, and it interacts with `Session.dayId` history in ways worth designing separately).
  - Active-workout additions: "last time" reference per exercise, a rest timer, a workout notes textarea.
  - "New Exercise" modal for creating custom exercises with a category.
  - Profile additions: "Edit Program" settings row, kg/lb units toggle.
  - Progress page: SVG estimated-1RM trend chart above the session-history table.
  - Mobile-first rules called out in the mockup note: safe-area-inset-bottom padding on the fixed tab bar, 44px minimum tap targets, numeric keyboards (`inputmode="decimal"`/`"numeric"`) for weight/reps inputs, rest timer stays visible while scrolling.
- `/guide` (the `TODO.md`-specced Estimated 1RM PB explanation page) is explicitly skipped for now, per direct user decision on 2026-07-20. Do not build it unless the user asks again — it is off the active build sequence, not just deferred by default.

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
- 2026-06-17: Added `server/src/modules/programs/starterProgram.ts`, `server/src/modules/dashboard/dashboard.routes.ts`, and `client/src/lib/dashboard.ts`. New users now get the starter program, `/dashboard` returns suggested day/routine/stats, and `client/src/pages/DashboardPage.tsx` renders real dashboard data. Verified `npm exec -w server -- tsc --noEmit`, `npm run build -w client`, and a live register + `GET /dashboard` smoke test.
- 2026-06-17: Added `server/src/modules/sessions/`, mounted `/sessions`, added `client/src/lib/sessions.ts`, registered protected `/workout/:sessionId`, and wired dashboard Start Workout/day pills to create a session and navigate to the workout shell. Verified `npm exec -w server -- tsc --noEmit`, `npm run build -w client`, and live register + dashboard + start-session + get-session smoke tests.
- 2026-06-17: Updated `server/src/modules/programs/starterProgram.ts` and `server/prisma/seed.ts` to use the mockup badge palette. Updated `client/src/pages/DashboardPage.tsx` so badge colors are derived from day names and dashboard day-picker pills remain neutral like the mockup. Verified `npm exec -w server -- tsc --noEmit` and `npm run build -w client`.
- 2026-06-17: Added `POST /sessions/:sessionId/exercises/:sessionExerciseId/sets` with Zod validation and authenticated session-exercise ownership checks. Added `addSet()` to `client/src/lib/sessions.ts` and inline add-set forms/set display to `client/src/pages/WorkoutPage.tsx`. Verified `npm exec -w server -- tsc --noEmit`, `npm run build -w client`, and live register + dashboard + start-session + add-set + get-session smoke tests.
- 2026-06-17: Changed dashboard recent-session cards from static cards to links targeting `/workout/:sessionId`, allowing in-progress sessions with logged sets to be reopened from the dashboard. Verified `npm run build -w client` and `npm exec -w server -- tsc --noEmit`.
- 2026-06-18: Added backend `PATCH`/`DELETE` set-log routes with auth ownership checks, finished-session mutation guards, and delete-order compaction. Verified `npm exec -w server -- tsc --noEmit` and a live add/patch/delete/order smoke test against a temporary updated server on port 4001. A pre-existing port 4000 server did not include the new routes, so it was left untouched.
- 2026-06-21: Confirmed `WorkoutPage.tsx` was still missing the visible edit/delete controls, then wired set pencil/trash actions, inline edit form, finish-workout button, and completed-workout read-only state. Verified with `npm run build -w client` and `npm exec -w server -- tsc --noEmit`.
- 2026-06-21: Added `VITE_API_URL` support in `client/src/lib/api.ts`, plus `client/.env.example` and `server/.env.example` with LAN testing notes. Verified with `npm run build -w client`.
- 2026-06-21: Updated dashboard recent-session copy so completed workouts read `Finished · Duration: X min` instead of only showing the minute count.
- 2026-06-21: Added accessible Show/Hide toggles to the current, new, and confirm password fields on the change-password page.
- 2026-06-21: Updated the change-password Show/Hide toggles so clicking them preserves focus and cursor selection in the active password input.
- 2026-06-21: Browser smoke tests passed for auth redirects, dashboard/workout flow, full set/session lifecycle, and account pages. Added `GET /sessions/history`, `getSessionHistory()`, protected `/history`, month-grouped history cards, and a dashboard `View all` link. Verified with `npm run build -w client` and `npm exec -w server -- tsc --noEmit`.
- 2026-06-21: Added `typecheck` to `server/package.json`, replacing the long server verification command with `npm run typecheck -w server`. Verified the new script passes.
- 2026-06-21: Changed dashboard/history workout links to include `?from=dashboard` or `?from=history`, then updated `WorkoutPage.tsx` to use that source for the header back link. Verified with `npm run build -w client`.
- 2026-06-22: Added `server/src/modules/progress/progress.routes.ts`, mounted `/progress`, added `client/src/lib/progress.ts`, created `client/src/pages/ProgressPage.tsx`, registered protected `/progress`, and linked it from dashboard stats. Verified `npm run build -w client` and `npm exec -w server -- tsc --noEmit`.
- 2026-06-23: Changed Progress PB from raw heaviest set to Epley estimated 1RM using finished-session `NORMAL` sets only. The page now labels the main card `Estimated 1RM PB`, shows the source set, keeps raw heaviest set as a stat, and trends estimated 1RM. Verified `npm run build -w client` and `npm run typecheck -w server`.
- 2026-06-30: Added protected `GET /exercises`, active-session exercise add/swap/remove backend routes, typed client helpers, and Workout page controls/modal for managing exercises during unfinished workouts. This is session-only and does not alter saved routine templates. Verified `npm run build -w client` and `npm run typecheck -w server`; manual browser smoke testing is still pending.
- 2026-07-01: Moved the active-workout remove exercise button to the rightmost card action position. Verified `npm run build -w client`.
- 2026-07-01: Replaced all workout `window.confirm` delete popups with a styled in-app confirmation modal for set deletion and exercise removal. Verified no remaining `window.confirm` calls under `client/src` and `npm run build -w client` passes.
- 2026-07-20: Reconciled stale mockup/build-plan filename references in `AGENTS.md` and `STATUS.md` after discovering the mockup folder rename (`atomic-moore-mockup` → `Replog-mockup`) and an uncommitted build-plan PDF rename (`AtomicMoore-Build-Plan.pdf` → `Replog-Build-Plan.pdf`) hadn't been reflected in the docs. Also discovered `Replog-mockup/Replog-mockup.html` was substantially rewritten as a forward-looking design spec with several unbuilt features (persistent nav, forgot/reset password, `/program` editor, rest timer/notes/last-time reference, new-exercise modal, units toggle, progress chart) and recorded them in a new "Backlog" section rather than building them, per the user's direction to finish pending smoke tests first. Attempted automated browser smoke testing via `claude-in-chrome` but abandoned it after unreliable viewport/element-ref behavior (recorded in memory as `feedback_manual_smoke_testing`); the user's real logged-in session got logged out along the way and needs the user to log back in manually. At the user's request, verified `/history`, `/progress`, and active-workout exercise management purely at the API level instead, with a 32-assertion Node/fetch smoke-test script (`smoke-test.mjs`, not committed to the repo) against a disposable test account — all 32 passed, including order renumbering, finished-session mutation blocking (409s), and the Epley 1RM formula/trend. Visual-only UI aspects (empty-state copy, month grouping, picker/modal UI) were not covered and are left as an optional manual spot-check in Next Actions.
- 2026-07-20: Drafted an implementation plan for `/guide` (static Estimated 1RM PB explanation page plus a discoverability link from `/progress`), then the user decided to skip building `/guide` for the entire project going forward rather than implement it. Next Actions item 4 is now marked done-as-skipped, and a Backlog note records the decision so a future session doesn't restart the work without being asked.
- 2026-07-28: Picked the persistent-navigation Backlog item as the next task. Added `client/src/components/nav/navItems.ts`, `BottomTabBar.tsx` (fixed, mobile-only), and `TopNav.tsx` (inline, desktop-only), then wired both into `/dashboard`, `/history`, `/progress`, and `/profile` — each page's existing bespoke header/back-link was left untouched, only `<TopNav />`/`<BottomTabBar />` were added, plus mobile-only bottom padding on each page's `<main>` so content isn't obscured by the fixed tab bar. Program is intentionally omitted from the nav since `/program` doesn't exist yet. While editing `ProgressPage.tsx`'s header, fixed a pre-existing typo (`to="\dashboard"` → `to="/dashboard"`) that had silently broken that back-link. Verified with `npm run build -w client`. Manual browser spot-check of the nav itself is still open (Next Actions item 6).
- 2026-07-29: Built the `/program` routine editor (next Backlog item). Scope decisions made with the user up front: day delete lives inside the pencil edit-day modal (not a separate card icon, matching the mockup's visual surface while still giving an undo path) rather than being deferred; whole-day reordering is deferred (no backlog/mockup support, and it interacts with `Session.dayId` history in ways worth designing separately); the exercise-picker/delete-confirmation modals were duplicated locally into `ProgramPage.tsx` from `WorkoutPage.tsx`'s existing pattern rather than extracted into shared components, to avoid bundling a refactor of an already-shipped, manually-verified page into this feature (extraction is a candidate follow-up). Added backend `server/src/modules/programs/programs.routes.ts` + `programs.schemas.ts` (mounted at `/programs`), reusing existing ownership-scoping/order-renumbering/partial-update conventions from `sessions.routes.ts`; the day-exercise reorder endpoint uses a transient sentinel order (`-1`) to work around SQLite's immediate (non-deferred) unique-constraint checking during an adjacent-swap transaction. `Day.badgeColor` became a closed 8-color enum (`DAY_BADGE_COLORS`) instead of a free-text string now that it's user-writable for the first time; extracted `getBadgeClass()` out of `HistoryPage.tsx` into shared `client/src/lib/badgeColors.ts` (now covering all 8 colors) so both pages render badges consistently and Tailwind's build-time class scanner sees every literal. Added client `lib/programs.ts` (mirroring `lib/sessions.ts` conventions) and `pages/ProgramPage.tsx`, registered `/program` in the router, and added a Program nav tab between Progress and Profile (picked up automatically by the existing data-driven `BottomTabBar`/`TopNav`). Verified with `npm exec -w server -- prisma validate`, `npm run typecheck -w server`, `npm run build -w client` (confirmed all 8 badge-color utility classes compiled into the CSS output), and a 39-assertion Node/fetch API smoke test run against a temporary port-4001 server (the user's own port-4000 dev server was left untouched, per the established convention from the 2026-06-18 session note) — covering starter-program auto-provisioning, day/exercise CRUD, partial updates, invalid-badge-color validation, reorder up/down including the already-first 409 case, delete renumbering for both exercises and days, cross-user ownership 404s, and — the key non-negotiable check — that deleting a Day whose template a past `Session` was started from leaves that session's `dayName`/`badgeColor` snapshot fields untouched. Manual browser spot-check of the new page is still open (Next Actions item 7).
