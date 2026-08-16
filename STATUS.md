# RepLog Status

## Current Phase
- MVP feature implementation is substantially complete through authentication, dashboard, workouts, history, progress, profile, Program editing, and password recovery.
- Current priority is mobile-first visual QA and polish. Treat 375px phone layouts as the primary acceptance target; verify mobile before larger breakpoints. Desktop responsive polish is optional unless it affects mobile behavior.

## Confirmed State
- Root workspace: `D:\coding\project\workout`
- Workspaces: `client`, `server`
- Source of truth: `Replog-mockup/Replog-mockup.html` and `Replog-Build-Plan.pdf`
- Client: Vite + React + TypeScript + Tailwind v4 + React Router + TanStack Query + Axios
- Server: Express + TypeScript + Prisma + SQLite + Zod
- Database schema, migration, generated client, seed data, and starter program are present.
- Last known Node version: `v25.6.1`

## Completed Features
- Email/password registration, login, logout, protected routes, guest-only routes, and JWT `httpOnly` cookie auth.
- Forgot/reset password routes with hashed, expiring, single-use tokens, rate limiting, auth-version session revocation, and Resend delivery integration.
- Profile editing and password changes with validation and bcrypt hashing.
- Dashboard with starter routine provisioning, suggested workout, day selection, recent sessions, and stats.
- Active workouts with session snapshots, add/edit/delete sets, warm-up/normal/drop kinds, finish flow, and read-only completed details.
- Active-workout exercise add, swap, remove, search, category grouping, and in-app confirmations.
- History page with finished-session API, month grouping, empty state, and read-only workout links.
- Progress page with exercise selection, Epley estimated-1RM PB, stats, session history, trend text, source links, and safe table overflow.
- Program editor with day add/rename/recolor/delete and exercise add/remove/reorder.
- Persistent navigation with mobile bottom tabs and desktop top navigation.
- Mobile polish covering safe-area spacing, dynamic viewport sizing, 44px controls, numeric inputs, focus states, long-content handling, and constrained accessible dialogs.

## Verification
- `npm run build -w client` passes.
- `npm run lint -w client` passes.
- `npm run typecheck -w server` passes.
- `git diff --check` passes.
- Live server smoke check passed on the current source: `/health`, disposable registration, authenticated `/auth/me`, `/dashboard`, invalid forgot-password validation, and configured-email forgot-password response.
- Backend auth, account, dashboard, sessions, history, progress, exercise management, Program, and password-reset API smoke tests have passed as recorded by recent commits.

## Next Actions
1. [ ] Manual mobile browser spot-check at `375px` and approximately `430px` for all primary routes.
2. [ ] Verify mobile bottom navigation active states, safe-area clearance, and that final content is not obscured.
3. [ ] Verify History and Progress populated/empty states, table behavior, links, and month grouping on mobile.
4. [ ] Verify Program add/edit/delete/recolor/exercise reorder flows and modal reachability on short mobile viewports.
5. [ ] Verify Workout picker and delete-confirmation dialogs with the mobile keyboard and narrow heights.
6. [ ] Optionally smoke-check `1080px+` desktop layouts after mobile acceptance is complete.
7. [ ] Add a valid `RESEND_API_KEY` to ignored `server/.env` and manually verify actual reset-email delivery.

## Deferred Backlog
- Rest timer, last-time exercise references, and workout notes.
- Custom exercise creation modal and user-owned exercise workflow.
- Profile kg/lb units preference.
- SVG estimated-1RM chart.
- Whole-day Program reordering.
- `/guide` is explicitly skipped unless the user asks for it again.

## Blockers
- Real password-reset email delivery requires a valid local `RESEND_API_KEY`; reset API behavior is already verified independently.
- No other blockers are recorded.

## Recent Notes
- 2026-08-15: Re-read the updated `AGENTS.md`, corrected its stale `client/` and `server/` existence facts, and completed the executable QA pass. Client build/lint, server typecheck, `git diff --check`, live health/auth/dashboard checks, and password-recovery validation passed. Rendered checks at 375px/430px and physical-device safe-area/keyboard checks remain manual because no browser automation is available in the repository environment.
- 2026-08-15: Mobile-first rule was made explicit in `AGENTS.md`; existing mobile polish was reverified with client build/lint, server typecheck, and `git diff --check`.
- 2026-08-15: Constrained Progress mobile layout widths, isolated table sizing, and added narrow-value wrapping after manual browser QA found right-side overflow at phone width. Client build/lint and `git diff --check` pass; browser recheck remains pending.
- 2026-08-15: Forgot/reset password recovery was completed and API-verified; actual Resend delivery remains pending configuration.
- Older implementation history is intentionally omitted from this handoff. Use Git history for detailed historical context.
