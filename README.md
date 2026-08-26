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
Railway build. It is public build-time configuration and is embedded in the client bundle.

The server requires `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_URL`. `DATABASE_URL` must be a PostgreSQL connection URL. `TEST_DATABASE_URL` is required by `npm test` and must point to a different database from `DATABASE_URL`. Development and test examples are in `server/.env.example`. `PORT` defaults to `4000`; `EMAIL_FROM` also has a local default.

Google sign-in is optional and requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`. The callback path is `/api/auth/google/callback`.

Password-reset email delivery is optional for local development and requires `RESEND_API_KEY` and `EMAIL_FROM` when enabled. It is required for a production launch that advertises password recovery.

## CI and production readiness

GitHub Actions runs on pushes and pull requests. It starts PostgreSQL 17, creates separate CI and test databases, generates and validates Prisma Client, migrates an empty PostgreSQL database, runs linting, typechecking, isolated tests, the client/server build, a compiled `/health` smoke check, and `git diff --check`.

Production serving is configured for a single Railway origin. The API is under `/api`, Express serves `client/dist`, and unknown client routes fall back to the Vite `index.html` while unknown `/api` routes remain JSON 404s.

## Railway deployment

`railway.toml` defines the production commands:

| Railway setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Pre-deploy command | `npm run migrate:deploy` |
| Start command | `npm start` |
| Health check path | `/health` |

`/health` is a dependency-free liveness check. `/ready` is the database-backed readiness endpoint and can be checked manually or used as a deployment probe when database readiness is required. The production start script sets `NODE_ENV=production` when Railway has not already set it, and Railway's injected `PORT` is used by Express.

Before deploying, create a Railway PostgreSQL service and set these application variables in the Railway dashboard:

- `DATABASE_URL` to the managed PostgreSQL connection URL.
- `JWT_SECRET` to a strong random secret of at least 16 characters.
- `CLIENT_URL` to the public HTTPS application origin.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` if Google sign-in is enabled.
- `RESEND_API_KEY` and `EMAIL_FROM` if password-reset email is enabled.

Set the Google OAuth authorized redirect URI to `https://your-domain.example/api/auth/google/callback`. Do not set `VITE_API_URL` for the single-origin production build, and do not commit any of these values or environment files.

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
