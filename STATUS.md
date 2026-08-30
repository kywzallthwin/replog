# RepLog Status

## Current Phase
- Phase 0, Baseline: complete and committed.
- Phase 1, PostgreSQL: complete and verified locally against PostgreSQL.
- Phase 2, Production Serving: complete and verified locally against PostgreSQL.
- Phase 3, Render/Neon Security: implemented and verified locally; deployment changes are included in this commit.
- Deployment: live at https://replog-tracker.onrender.com; Render and Neon were manually verified.
- SQLite data may be discarded; no production data requires preservation.

## Roadmap
- Phase 0: stabilize and verify the CI safety net. Complete.
- Phase 1: migrate local, test, CI, and deployment database use to PostgreSQL.
- Phase 2: add `/api` namespacing and single-origin production serving.
- Phase 3: harden security for Render HTTPS deployment with Neon PostgreSQL. Complete.
- Phase 4: add invite-only registration and safe authentication/linking.
- Phase 5: add privacy, terms, deletion, and export controls.
- Phase 6: address dependencies, accessibility, reliability, logging, and monitoring.
- Phase 7: prepare staging deployment; dashboard and DNS work is manual.

## Confirmed State
- Workspaces: `client`, `server`; mobile-first acceptance remains the priority. The slate-monochrome SVG branding pass is implemented on `ui/mobile-audit` and manually verified at 375px.
- Server: Express 5 + TypeScript + Prisma + PostgreSQL + Zod.
- Runtime and seed use `@prisma/adapter-pg`; SQLite is removed.
- Render target: one Free Node Web Service in Singapore; Neon is the external Free PostgreSQL provider.
- Runtime uses pooled `DATABASE_URL`; Prisma CLI uses direct `DATABASE_URL_UNPOOLED`.
- Tests use a separate `TEST_DATABASE_URL` database and a temporary per-run schema.
- API routers are mounted under `/api`; unknown API requests return JSON 404s.
- Production startup serves `client/dist` and falls back to its `index.html` for client routes.
- `NODE_ENV` is validated; production client and OAuth URLs must use HTTPS.
- Express binds to `0.0.0.0`; Render supplies the production `PORT`.
- Proxy trust is numeric `1`, matching Render's one TLS-terminating reverse-proxy hop.
- Production auth and OAuth state cookies are HTTP-only, `SameSite=Lax`, and secure.
- Security headers, API `no-store` caching, a 100 KB JSON limit, and safe error handlers are enabled.
- Unsafe cookie-authenticated requests require the configured origin or same-origin Fetch Metadata in production.
- Registration, login, OAuth initiation, and password recovery have JSON rate limits.
- Password changes rotate `authVersion` and reissue the current cookie, invalidating other sessions.
- SIGINT/SIGTERM close the HTTP server and disconnect Prisma gracefully.

## Verification
- `npm run check` passes end to end against local PostgreSQL.
- GitHub Actions CI run 7 passes on commit `0ad1b17`.
- Security, production serving, program, session, and database tests pass.
- `git diff --check` passes.
- `npm run smoke:health` passes against the compiled server.
- The client build retains the existing warning about the main JavaScript chunk exceeding 500 kB.
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
- Audit and polish the mobile UI at the 375px acceptance width.
- Decide whether public registration should remain enabled or become invite-only.
- Do not begin Phase 4 until the mobile UI audit is complete.

## Deferred Backlog
- `/guide`, rest timer enhancements, last-time references, workout notes, unit preferences, SVG chart, and day reordering.

## Remaining Risks
- Google OAuth and email delivery remain unverified because those integrations are optional and not configured.
- Render Free and Neon Free can sleep; the first request after idle time can be slow.
- Rate limits use process-local memory and reset when the single Free instance restarts.
- Existing concurrent order-allocation and check-then-write behavior remains unchanged.
- The client JavaScript bundle remains above the current 500 kB warning threshold.
- Existing production dependency audit findings remain.
- No credentials or environment files may be committed.
