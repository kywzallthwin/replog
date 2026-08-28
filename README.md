# RepLog

RepLog is a mobile-first workout tracker for planning routines, logging sets, and tracking strength progress.

The app helps lifters keep a structured program, record active workouts, review completed sessions, and follow estimated strength progress over time.

## Features

- Email/password authentication with protected routes and secure HTTP-only cookie sessions
- Optional Google OAuth sign-in and account linking
- Dashboard with routine days, suggested workouts, recent sessions, and training statistics
- Multiple editable programs with beginner templates, blank routines, copying, and active-program switching
- Active workout logging with warm-up, normal, and drop sets, a persistent rest timer, and previous-workout references
- Add, swap, remove, search, and reorder exercises during a workout
- Program editing for names, days, colors, exercises, and exercise order
- Workout history grouped by month
- Progress tracking with estimated one-rep-max personal bests, session history, and trends
- Profile editing, password changes, and password recovery
- User-owned custom exercise creation with duplicate protection
- Mobile bottom navigation and responsive layouts designed around 375px phone screens

## Tech stack

- Client: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, and Axios
- Server: Express, TypeScript, Prisma, PostgreSQL, Zod, and JSON Web Token authentication
- Workspace: npm workspaces with separate `client` and `server` packages

## Local development

### Requirements

- Node.js `24.19.0` (use the version in `.nvmrc`)
- npm `11.9.0`
- PostgreSQL `17` for local development and tests

### Install

```bash
npm ci
```

Create local environment files from the examples:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

On PowerShell, use `Copy-Item` instead of `cp` if needed.

Create separate PostgreSQL databases for development and tests before running the server:

```bash
createdb replog
createdb replog_test
```

The server uses PostgreSQL for local development. Prisma Client is generated automatically during workspace installation. The PostgreSQL baseline migration and seed data are included in the repository. Tests use `TEST_DATABASE_URL`, create a temporary schema in that database, and remove the schema after each run.

### Run the app

Start both workspaces:

```bash
npm run dev
```

The client runs at `http://localhost:5173` and the API runs at `http://localhost:4000/api` by default.

To apply migrations to an existing local database:

```bash
npm run migrate:deploy
```

To load the example data after applying migrations:

```bash
npm run seed -w server
```

### Verify changes

Run the complete local safety net:

```bash
npm run check
```

For individual checks:

```bash
npm run prisma:generate
npm run prisma:validate
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke:health
git diff --check
```

`npm test` discovers every `server/tests/**/*.test.ts` file, migrates a unique temporary schema in the separate test database, runs tests serially, and removes the schema afterward. `npm run smoke:health` starts the compiled server and checks `/health`; it is a liveness check. `GET /ready` performs a database-backed readiness check and returns `503` when the database is unavailable.

## Environment variables

`VITE_API_URL` is optional for local development. When omitted, the client uses
the browser's current hostname on port `4000`, so both `localhost:5173` and
your PC's LAN IP work without changing environment files. When set, it should be
the API server origin; the client appends `/api`. Production builds always use
the same-origin relative `/api` path, so `VITE_API_URL` should not be set for the
Render build. It is public build-time configuration and is embedded in the client bundle.

The server requires `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_URL`. `DATABASE_URL` is the runtime PostgreSQL connection and `DATABASE_URL_UNPOOLED` is the direct PostgreSQL connection used by Prisma CLI migrations and seeding. `DATABASE_URL_UNPOOLED` falls back to `DATABASE_URL` for local development, but both URLs are required and must use TLS in production. `TEST_DATABASE_URL` is required by `npm test` and must point to a different database from `DATABASE_URL`. Development and test examples are in `server/.env.example`. `NODE_ENV` accepts `development`, `test`, `ci`, or `production` and defaults to `development`. `PORT` defaults to `4000`; `EMAIL_FROM` also has a local default.

Google sign-in is optional and requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`. The callback path is `/api/auth/google/callback`. In production, `CLIENT_URL` and any configured `GOOGLE_CALLBACK_URL` must use HTTPS and `CLIENT_URL` must be an origin without a path.

Password-reset email delivery is optional for local development and requires `RESEND_API_KEY` and `EMAIL_FROM` when enabled. It is required for a production launch that advertises password recovery.

## CI and production readiness

GitHub Actions runs on pushes and pull requests. It starts PostgreSQL 17, creates separate CI and test databases, generates and validates Prisma Client, migrates an empty PostgreSQL database, runs linting, typechecking, isolated tests, the client/server build, a compiled `/health` smoke check, and `git diff --check`.

Production serving is configured for a single Render origin. The API is under `/api`, Express serves `client/dist`, and unknown client routes fall back to the Vite `index.html` while unknown `/api` routes remain JSON 404s.

The server trusts exactly one reverse-proxy hop, matching Render's TLS-terminating edge. Express binds to `0.0.0.0` and uses Render's injected `PORT`. Production auth and OAuth state cookies are HTTP-only, `SameSite=Lax`, and `Secure`. API responses are not cacheable, use a restrictive referrer policy and security headers, and unsafe requests carrying an auth cookie must include the configured `Origin` or same-origin Fetch Metadata. Registration, login, OAuth initiation, and password recovery endpoints are rate limited.

## Render + Neon deployment

RepLog deploys as one Render Free Web Service in the Singapore region. The React client and Express API stay on one origin, and Neon provides the persistent PostgreSQL database. This setup does not require a payment method. Render Free services sleep after inactivity and Neon Free compute can scale to zero, so the first request after idle time can be slow.

The root `render.yaml` Blueprint defines these service settings:

| Render setting | Value |
| --- | --- |
| Region | Singapore |
| Plan | Free |
| Build command | `npm ci --include=dev && npm run build && npm run migrate:deploy` |
| Start command | `npm start` |
| Health check path | `/health` |
| Auto-deploy | After CI checks pass |

Render Free Web Services do not provide a pre-deploy command, so the build command applies Prisma migrations with the direct Neon connection before the new service instance starts. Migrations are idempotent and the build fails if they cannot be applied. Do not run the demo seed automatically in production; normal registration creates the global exercise catalog and a starter program for each user.

### Neon setup

Create a Neon Free project in Singapore and copy two connection strings from the production branch:

- `DATABASE_URL`: pooled Neon URL. Its hostname contains `-pooler` and is used by the running application.
- `DATABASE_URL_UNPOOLED`: direct Neon URL without `-pooler` and is used by Prisma migrations and seed operations.

Both URLs must include `sslmode=require`. Keep them in Render's secret environment variables and never commit them. Do not create a Render PostgreSQL database for this setup; Render's Free PostgreSQL database expires after 30 days.

### Render setup

Connect the GitHub repository to Render and create a Web Service from the root of the repository. The Blueprint can be applied from the Render dashboard, or these values can be entered manually. Leave the root directory blank because the build uses the root npm workspaces. Select the Free plan and Singapore region.

Set these application variables:

- `DATABASE_URL` to the Neon pooled connection URL.
- `DATABASE_URL_UNPOOLED` to the Neon direct connection URL.
- `JWT_SECRET` to a strong random secret of at least 16 characters.
- `CLIENT_URL` to the exact public HTTPS application origin. The Blueprint derives it from Render's `RENDER_EXTERNAL_URL`; set it manually if creating the service from the dashboard.
- `NODE_ENV` to `production`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` if Google sign-in is enabled.
- `RESEND_API_KEY` and `EMAIL_FROM` if password-reset email is enabled.

Render generates `JWT_SECRET` from the Blueprint. Keep it unchanged after users begin signing in. Set the Google OAuth authorized redirect URI to `https://your-domain.example/api/auth/google/callback`. Do not set `VITE_API_URL` for the single-origin production build, and do not commit any of these values or environment files.

`/health` is a dependency-free liveness check used by Render. `/ready` is the database-backed readiness endpoint and returns `503` when Neon is unavailable. After deployment, verify both endpoints, register and log in, refresh the browser, save a set, finish a workout, and confirm the completed duration appears in history. Render's filesystem is ephemeral, but workout data is stored in Neon and the client-side rest timer is stored in browser `localStorage`.

## Project status

The MVP includes authentication, dashboard, multiple program management, workout logging, history, progress, profile management, password recovery, custom exercise creation, and read-only completed-workout summaries. Multiple-program browser acceptance is complete. Production-readiness progress is tracked in `STATUS.md`.

Deferred ideas include a guide page, unit preferences, an estimated-1RM chart, and whole-day program reordering.

## Repository layout

```text
client/             React and Vite frontend
server/             Express API, Prisma schema, migrations, and seed data
Replog-mockup/      AtomicMoore HTML mockup and interaction reference
Replog-Build-Plan.pdf
STATUS.md           Current implementation handoff and verification status
```
