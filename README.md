# RepLog

RepLog is a mobile-first workout tracker for planning routines, logging sets, and tracking strength progress.

The app helps lifters keep a structured program, record active workouts, review completed sessions, and follow estimated strength progress over time.

## Features

- Email/password authentication with protected routes and secure HTTP-only cookie sessions
- Optional Google OAuth sign-in and account linking
- Dashboard with routine days, suggested workouts, recent sessions, and training statistics
- Multiple editable programs with beginner templates, blank routines, copying, and active-program switching
- Active workout logging with warm-up, normal, and drop sets
- Add, swap, remove, search, and reorder exercises during a workout
- Program editing for names, days, colors, exercises, and exercise order
- Workout history grouped by month
- Progress tracking with estimated one-rep-max personal bests, session history, and trends
- Profile editing, password changes, and password recovery
- User-owned custom exercise creation with duplicate protection
- Mobile bottom navigation and responsive layouts designed around 375px phone screens

## Tech stack

- Client: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, and Axios
- Server: Express, TypeScript, Prisma, SQLite, Zod, and JSON Web Token authentication
- Workspace: npm workspaces with separate `client` and `server` packages

## Local development

### Requirements

- Node.js 20.19+ (or a supported Node.js 22/24+ release)
- npm

### Install

```bash
npm install
```

Create local environment files from the examples:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

On PowerShell, use `Copy-Item` instead of `cp` if needed.

The server uses SQLite for local development. Prisma Client is generated automatically during workspace installation. The migration and seed data are included in the repository.

### Run the app

Start both workspaces:

```bash
npm run dev
```

The client runs at `http://localhost:5173` and the API runs at `http://localhost:4000` by default.

To apply migrations to an existing local database:

```bash
npm run migrate:deploy -w server
```

### Verify changes

```bash
npm run build -w client
npm run lint -w client
npm run typecheck -w server
git diff --check
```

## Environment variables

`VITE_API_URL` is optional for local development. When omitted, the client uses
the browser's current hostname on port `4000`, so both `localhost:5173` and
your PC's LAN IP work without changing environment files. Set it explicitly for
production or when the API is hosted elsewhere.

The server requires the values in `server/.env.example`, including `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, and `PORT`.

Google sign-in is optional and requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`.

Password-reset email delivery is optional for local development and requires `RESEND_API_KEY` and `EMAIL_FROM` when enabled.

## Project status

The MVP includes authentication, dashboard, multiple program management, workout logging, history, progress, profile management, password recovery, and custom exercise creation. Existing mobile and desktop acceptance is complete; the new Programs library still needs rendered browser verification.

Deferred ideas include a guide page, rest timer, last-time exercise references, workout notes, unit preferences, an estimated-1RM chart, and whole-day program reordering.

## Repository layout

```text
client/             React and Vite frontend
server/             Express API, Prisma schema, migrations, and seed data
Replog-mockup/      AtomicMoore HTML mockup and interaction reference
Replog-Build-Plan.pdf
STATUS.md           Current implementation handoff and verification status
```
