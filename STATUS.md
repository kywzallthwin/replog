# RepLog Status

## Current Phase
- Phase 0, Baseline: complete and committed.
- Phase 1, PostgreSQL: complete and verified locally against PostgreSQL.
- Phase 2, Production Serving: complete and verified locally against PostgreSQL.
- Phase 3, Render/Neon Security: implemented and verified locally; deployment configuration is present.
- Deployment: live at https://replog-tracker.onrender.com; Render and Neon were manually verified.
- SQLite data may be discarded; no production data requires preservation.

## Roadmap
- High-level sequence and dependencies: `ROADMAP.md`.
- Wave 1 is current; Waves 2-8 are sequenced in `ROADMAP.md`.

## Confirmed State
- Workspaces: `client`, `server`; mobile-first acceptance remains the priority. The slate-monochrome SVG branding pass and auth form polish are implemented; branding was manually verified at 375px.
- Server: Express 5 + TypeScript + Prisma + PostgreSQL + Zod; runtime and seed use `@prisma/adapter-pg`, and SQLite is removed.
- Render target: one Free Node Web Service in Singapore with Neon Free PostgreSQL; runtime uses pooled `DATABASE_URL` and CLI uses direct `DATABASE_URL_UNPOOLED`.
- Tests use a separate `TEST_DATABASE_URL` database and a temporary per-run schema.
- API routers use `/api`; unknown API requests return JSON 404s. Production serves `client/dist` with SPA fallback for client routes.
- `NODE_ENV` and production HTTPS URLs are validated; Express binds to `0.0.0.0`, Render supplies `PORT`, and proxy trust is one hop.
- Production auth and OAuth state cookies are HTTP-only, `SameSite=Lax`, and secure. Security headers, API `no-store`, a 100 KB JSON limit, safe errors, and unsafe-request origin checks are enabled.
- Registration, login, OAuth initiation, and password recovery are rate limited. Password changes rotate `authVersion`, and SIGINT/SIGTERM close HTTP and Prisma gracefully.

## Current Work
- Current wave: `WAVE1.md`.
- Current ticket: `W1-02` (`done`); next ticket is `W1-03` (`proposed`, not started). W1-01's 375px baseline audit and review are complete.
- Settled decisions: public registration, canonical kilogram storage with later pound display conversion, and immediate permanent account deletion.
- Do not implement the latter two product features during Wave 1.

## Verification
- `npm run check` passes end to end against local PostgreSQL.
- GitHub Actions CI run 7 passes on commit `0ad1b17`.
- Security, production serving, program, session, and database tests pass.
- `git diff --check` passes.
- `npm run smoke:health` passes against the compiled server.
- Client auth UI lint, typecheck, and build pass; the client build retains the existing warning about the main JavaScript chunk exceeding 500 kB.
- W1-01 local audit and review completed at exactly 375px; the corrected F-01 evidence citation was verified and the ticket is done.
- W1-02 review passed: the client harness blocks unexpected network traffic, clears test QueryClients, and keeps 4 known-defect assertions as explicit expected failures; 6 normal client tests and all 10 server tests pass.
- `npm audit --omit=dev` reports existing dependency vulnerabilities; no automatic audit fix was applied.

## Manual Actions
- Local PostgreSQL 17 is running with separate `replog` and `replog_test` databases.
- The ignored `server/.env` contains local PostgreSQL URLs; never commit it. Local Prisma CLI falls back to `DATABASE_URL` when `DATABASE_URL_UNPOOLED` is absent.
- Production URL: `https://replog-tracker.onrender.com`.
- Render `/health` and `/ready` both return 200; the initial free-tier cold start was observed and recovered successfully.
- Registration, login, workout persistence, timer persistence across refresh, workout completion, and History were manually verified in production.
- The production seed was intentionally skipped; normal registration creates the global exercise catalog and starter program.
- Keep the generated `JWT_SECRET` and exact HTTPS `CLIENT_URL` unchanged after deployment.
- Register the HTTPS Google callback at `/api/auth/google/callback` with Google.
- Render applies migrations during the build; do not auto-seed the demo user in production.

## Next Actions
- Prepare W1-03; do not begin implementation until its ticket is moved to `in progress`. Later promote W1-02's expected-failure assertions after the owning UI fixes land.
- [ ] Define and add dashboard streak progress; confirm streak rules and timezone behavior before implementation.
- [ ] Improve Suggested Today behavior and empty states; confirm suggestion rules before implementation.
- [ ] Add a Dashboard button linking to the active program page, with `/program` as the fallback.
- [ ] Improve page-level loading states with the RepLog logo and a consistent branded loading treatment; confirm animation style and screen coverage before implementation, then resolve W1-05 dashboard decisions before W1-06.
- Do not begin Wave 2 / Phase 4 until the mobile UI audit is complete.

## Deferred Backlog
- `/guide`, rest timer enhancements, last-time references, workout notes, unit preferences, SVG chart, and day reordering.

## Remaining Risks
- Google OAuth and email delivery remain unverified because those integrations are optional and not configured.
- Render Free and Neon Free can sleep; the first request after idle time can be slow.
- Rate limits use process-local memory and reset when the single Free instance restarts.
- Existing concurrent order-allocation and check-then-write behavior remains unchanged.
- The client JavaScript bundle remains above the current 500 kB warning threshold; W1-02 retains four temporary expected-failure checks for W1-03/W1-04/W1-07 UI issues and they must be promoted after those fixes land.
- Existing production dependency audit findings remain.
- No credentials or environment files may be committed.
