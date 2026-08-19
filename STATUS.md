# RepLog Status

## Current Phase
- MVP feature implementation is substantially complete through authentication, Google OAuth, dashboard, workouts, history, progress, profile, Program editing, and password recovery. Local authentication connectivity and dashboard request latency were corrected in the latest session.
- Current priority is mobile-first visual QA and polish. Day badge colors now appear consistently on Dashboard, Program, Workout, and History; Dashboard day-picker controls use a single colored pill instead of a nested white pill; mobile navigation now uses the preferred edge-to-edge bar with Lucide line icons and a short top active indicator; coarse-pointer controls now provide rounded press feedback, with dedicated treatments for grouped Profile rows and Program icon/swatch controls. Treat 375px phone layouts as the primary acceptance target; verify mobile before larger breakpoints. Desktop responsive polish is optional unless it affects mobile behavior.

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
- Google server-redirect OAuth with state validation, verified-email enforcement, automatic linking to existing accounts, Google-only account creation, starter-program provisioning, and callback error handling. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in ignored `server/.env` before use.
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
- Local API/client URLs were corrected to use `localhost`; API requests now fail within 10 seconds instead of hanging indefinitely, and dashboard independent queries run concurrently.
- Live server smoke check passed on the current source: `/health`, disposable registration, authenticated `/auth/me`, `/dashboard`, invalid forgot-password validation, and configured-email forgot-password response.
- Backend auth, account, dashboard, sessions, history, progress, exercise management, Program, and password-reset API smoke tests have passed as recorded by recent commits.

## Next Actions
1. [ ] Manual browser check of login and dashboard after restarting both dev servers.
2. [ ] Manual mobile browser spot-check at `375px` and approximately `430px` for all primary routes, including the new day badge placements.
3. [ ] Verify mobile bottom navigation active states, safe-area clearance, and that final content is not obscured.
4. [ ] Verify History and Progress populated/empty states, table behavior, links, and month grouping on mobile.
5. [ ] Verify Program add/edit/delete/recolor/exercise reorder flows and modal reachability on short mobile viewports.
6. [ ] Verify Workout picker and delete-confirmation dialogs with the mobile keyboard and narrow heights.
7. [ ] Optionally smoke-check `1080px+` desktop layouts after mobile acceptance is complete.
8. [ ] Add Google OAuth credentials and manually verify new-account, existing-account-link, repeat-login, cancellation, and invalid-state flows.
9. [ ] Add a valid `RESEND_API_KEY` to ignored `server/.env` and manually verify actual reset-email delivery.

## Deferred Backlog
- Rest timer, last-time exercise references, and workout notes.
- Custom exercise creation modal and user-owned exercise workflow.
- Profile kg/lb units preference.
- SVG estimated-1RM chart.
- Whole-day Program reordering.
- `/guide` is explicitly skipped unless the user asks for it again.

## Blockers
- Real Google OAuth browser verification requires a Google Cloud OAuth client and registered callback URL; implementation is ready but credentials are not configured locally.
- Real password-reset email delivery requires a valid local `RESEND_API_KEY`; reset API behavior is already verified independently.
- No other blockers are recorded.

## Recent Notes
- 2026-08-20: Implemented the preferred Concept B mobile navigation in React with Lucide SVG icons, a full-width edge-to-edge bar, a short top active indicator, preserved 44px tab targets, and safe-area bottom padding. Desktop `TopNav` remains unchanged.
- 2026-08-19: Added a separate edge-to-edge mobile navigation comparison frame to `Replog-mockup.html`. It uses the same SVG icon language, removes the floating container treatment, and marks the active destination with a short top indicator. Existing floating navigation examples remain unchanged.
- 2026-08-19: Corrected stale LAN API/client URLs to localhost for local development, added a 10-second Axios timeout, enabled one-minute query freshness, and parallelized independent Dashboard database queries. Client build/lint, server typecheck, CORS, health, client loading, and invalid-login smoke checks passed after restarting the dev servers.
- 2026-08-17: Added the root GitHub-facing README, RepLog package description and keywords, and replaced the generic client Vite README with workspace documentation. GitHub CLI is not installed locally, so live repository description/topics remain to be updated through GitHub.
- 2026-08-17: Redesigned every mobile navigation example in `Replog-mockup.html` as a refined floating dock with inline SVG icons, inset elevation, compact active capsules, and updated mobile-first implementation notes. Desktop top navigation was intentionally unchanged.
- 2026-08-17: Refined the mobile Workout mockup header by replacing the small top Finish Workout button with an open, unboxed two-line duration timer; the full-width bottom Finish Workout and Cancel Workout actions remain in place. Timer persistence and desktop mockups are unchanged.
- 2026-08-17: Updated the mobile HTML mockup with the active-workout/resume state, live session-duration demo, cancel-workout action and confirmation, program-day exercise picker state, and duplicate exercise affordances. The demo timer is isolated to the mockup and uses sessionStorage; real client/server behavior is unchanged.
- 2026-08-16: Created a transparent PNG logo concept at `client/public/brand/replog-logo-concept.png`: a near-black `RepLog` wordmark with an R/log-row/progress-arrow monogram. It is not yet wired into the app or favicon.
- 2026-08-16: Added server-redirect Google OAuth with CSRF state cookies, verified-email checks, safe account linking, Google-only user provisioning, and client callback errors. Client build/lint, server typecheck, and `git diff --check` pass; provider round-trip verification remains pending credentials.
- 2026-08-16: Replaced the native Progress exercise selector with a styled accessible dropdown supporting click-outside, Escape, arrow/Home/End keyboard selection, internal scrolling, and mobile-friendly sizing. Client lint, production build, and `git diff --check` pass; browser viewport verification remains pending.
- 2026-08-15: Re-read the updated `AGENTS.md`, corrected its stale `client/` and `server/` existence facts, and completed the executable QA pass. Client build/lint, server typecheck, `git diff --check`, live health/auth/dashboard checks, and password-recovery validation passed. Rendered checks at 375px/430px and physical-device safe-area/keyboard checks remain manual because no browser automation is available in the repository environment.
- 2026-08-15: Mobile-first rule was made explicit in `AGENTS.md`; existing mobile polish was reverified with client build/lint, server typecheck, and `git diff --check`.
- 2026-08-15: Constrained Progress mobile layout widths, isolated table sizing, and added narrow-value wrapping after manual browser QA found right-side overflow at phone width. Client build/lint and `git diff --check` pass; browser recheck remains pending.
- 2026-08-16: Redesigned Workout and Program delete-confirmation dialogs for mobile: compact mockup proportions, no oversized warning icon, tighter spacing, and outlined red actions that stay on one line. Client build/lint and `git diff --check` pass; browser recheck remains pending.
- 2026-08-16: Added shared body-scroll locking for Workout and Program modals, preserving and restoring the page scroll position while dialogs and pickers are open. Client build/lint and `git diff --check` pass; physical mobile recheck remains pending.
- 2026-08-15: Forgot/reset password recovery was completed and API-verified; actual Resend delivery remains pending configuration.
- 2026-08-16: Applied day badge colors to Dashboard day choices, suggested workout, recent sessions, and active workout summary. Client build, lint, and diff checks passed; rendered mobile verification remains pending.
- 2026-08-16: Flattened Dashboard day-picker buttons into single colored pills to remove the overly thick nested white border. Client build and lint passed; rendered mobile verification remains pending.
- 2026-08-16: Added global coarse-pointer press feedback with tap highlight, subtle scale/filter feedback, touch-action optimization, and reduced-motion handling. Rendered physical-device verification remains pending.
- 2026-08-16: Removed the native rectangular mobile tap overlay and softened the press scale/brightness treatment for rounded controls. Rendered physical-device verification remains pending.
- 2026-08-16: Added dedicated press feedback for grouped Profile settings rows so they highlight softly and shift their content instead of showing a rectangular dark overlay. Rendered physical-device verification remains pending.
- 2026-08-16: Added shape- and tone-specific press feedback for Program edit, reorder, remove, and color-swatch controls; disabled reorder controls remain inert. Rendered physical-device verification remains pending.
- Older implementation history is intentionally omitted from this handoff. Use Git history for detailed historical context.
