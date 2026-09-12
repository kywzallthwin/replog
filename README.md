# RepLog

RepLog is a workout tracker for planning routines, recording sets, and following strength progress.

## What it includes

- Workout programs and editable routines
- Active workout logging, including warm-up and drop sets
- Exercise search, replacement, removal, and reordering
- Workout history, notes, and progress tracking
- Account management, password recovery, and custom exercises
- A responsive interface designed for phones

The app uses React and TypeScript on the client, and Express, Prisma, and PostgreSQL on the server.

## Languages and tools

- **TypeScript** for the client and server code
- **HTML and CSS** for the page structure and styling
- **SQL** through PostgreSQL and Prisma for workout data
- **React and Vite** for the frontend
- **Express and Node.js** for the API
- **Tailwind CSS** for responsive styling

## Run locally

### Requirements

- Node.js `24.19.x`
- npm `11.9.x`
- PostgreSQL `17`

### Setup

1. Install the dependencies:

   ```bash
   npm ci
   ```

2. Create environment files from the examples:

   ```bash
   cp client/.env.example client/.env
   cp server/.env.example server/.env
   ```

   On PowerShell, use `Copy-Item` instead of `cp`.

3. Create the local databases:

   ```bash
   createdb replog
   createdb replog_test
   ```

4. Check `server/.env` and set the database URLs. Keep the development and test databases separate.

5. Start the app:

   ```bash
   npm run dev
   ```

The client runs at `http://localhost:5173`. The API runs at `http://localhost:4000/api`.

If the database already exists and needs the latest schema, run:

```bash
npm run migrate:deploy
```

## Useful commands

```bash
npm run check          # Run all checks
npm test               # Run tests
npm run build          # Build the app
npm run lint           # Check code style
npm run typecheck      # Check TypeScript
```

To load example data in a local database:

```bash
npm run seed -w server
```

## Environment files

The example files list the available settings:

- `client/.env.example` for client settings
- `server/.env.example` for server and database settings

Never commit `.env` files or secrets. Production database connections must use TLS.

## Deployment

RepLog can run as one Render service with a Neon PostgreSQL database. Render serves both the client and API, while Neon stores the data.

For production, configure the database URLs, `JWT_SECRET`, and `CLIENT_URL` in Render's environment settings. Use HTTPS for the app URL and OAuth callback URL. Render uses `/health` as its health check.

## Project files

```text
client/        React frontend
server/        Express API and database files
Replog-mockup/ UI reference
STATUS.md      Current project status
tickets/       Implementation tickets
```

See [`STATUS.md`](STATUS.md) for the current project status.
