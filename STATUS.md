# RepLog Status

## Current Phase
- Phases 0-2 (baseline, PostgreSQL, production serving): complete and verified.
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
- Current ticket: `W1-06` (`review`); corrected shell, navigation, dashboard, and loading treatment are implemented and ready for independent acceptance review.
- Next ticket: `W1-07` (`proposed`); correct program and exercise-picker mobile issues.
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
- W1-02 review passed: the client harness blocks unexpected network traffic and clears test QueryClients. The client suite has 13 passing tests including the promoted W1-04 profile contracts; all 10 server tests pass, and W1-04's 375px/manual and independent reviews passed.
- W1-05 decision review passed: dashboard Up Next, active-program links, and branded loading treatment decisions are resolved. The three-rep loader prototype was visually approved at 375px. Documentation only; no application code changed.
- W1-06 correction complete: Up Next now skips empty days and wraps correctly; empty programs expose no workout-start controls; shared Program navigation targets the active editor with `/program` fallback; the loader matches the approved three-rep prototype with reduced-motion support; Profile waits for statistics. 22 client tests and 11 server tests pass; lint, typecheck, build, health smoke, and diff checks pass. Local Chrome CDP verification at exactly 375x900 found no horizontal overflow and confirmed the authenticated dashboard and shell-preserving loader.
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
- Complete independent acceptance review of W1-06, then begin W1-07: correct program and exercise-picker mobile issues.
- [ ] Before application streak work, write the calculation and timezone rules as a separate testable ticket.
- Do not begin Wave 2 / Phase 4 until the mobile UI audit is complete.

## Deferred Backlog
- `/guide`, dashboard streak progress and timezone rules, rest timer enhancements, last-time references, workout notes, unit preferences, SVG chart, and day reordering.

## Remaining Risks
- Google OAuth and email delivery remain unverified because those integrations are optional and not configured.
- Render Free and Neon Free can sleep; the first request after idle time can be slow.
- Rate limits use process-local memory and reset when the single Free instance restarts.
- Existing concurrent order-allocation and check-then-write behavior remains unchanged.
- The client JavaScript bundle remains above the current 500 kB warning threshold.
- Existing production dependency audit findings remain.
- No credentials or environment files may be committed.
