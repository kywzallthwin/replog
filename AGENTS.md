# AGENTS.md

## Project
- Name: `RepLog`
- Repo root: `D:\coding\project\workout`
- Goal: build RepLog from the AtomicMoore mockup and build plan, using this repo as the main workspace.

## Source Of Truth
- Mockup reference: `Replog-mockup/Replog-mockup.html`
- Build plan: `Replog-Build-Plan.pdf`
- Root workspace config: `package.json`
- Live handoff file: `STATUS.md`

## Current Repository Facts
- Git repo already initialized.
- Root npm workspace config already exists in `package.json`.
- Declared workspaces: `client`, `server`.
- `client/` exists as the Vite React client workspace.
- `server/` exists as the Express/Prisma server workspace.
- Target deployment is one Render Free Web Service in Singapore with Neon Free PostgreSQL.
- `render.yaml` defines the Render service; no Render-managed database is used.
- Root dev dependency already installed: `concurrently`.
- Root `dev` script currently runs both workspaces: `npm run dev`.
- Last verified local Node version: `v25.6.1`.

## How To Work In This Repo
1. Read `STATUS.md` first.
2. Verify the current file tree before assuming progress is still accurate.
3. Re-check `package.json` if setup-related work was done in a prior session.
4. Re-read the mockup and build plan before making structural UI decisions.
5. Prefer small, verifiable changes over large batches.
6. Confirm each setup step is complete before moving to the next one.

## Planned Build Order
1. Step 0: confirm or finish root workspace setup and dependency install.
2. Step 1: scaffold the Vite client app in `client/`.
3. Step 2: configure Tailwind in the client.
4. Continue feature implementation based on the mockup and build plan.

## Working Rules
- Preserve the mockup's structure and intent while translating it into the app.
- Mobile-first is the standing priority: treat 375px phone layouts as the primary acceptance target, verify mobile before larger breakpoints, and treat desktop responsive polish as optional unless it affects mobile behavior.
- Keep `STATUS.md` as a concise handoff document, generally around 40-70 lines. Preserve current state, next actions, blockers, backlog, and only the latest few session notes; do not append an exhaustive historical changelog.
- Do not assume a step is complete unless the files and commands confirm it.
- Record any plan changes, blockers, or setup deviations in `STATUS.md`.
- Update `STATUS.md` at the end of every session.
- Update this file only when project rules, architecture, tooling assumptions, or source-of-truth files change.

## Expected Workspace Shape
```text
/workout
  package.json
  package-lock.json
  AGENTS.md
  STATUS.md
  render.yaml
  /Replog-mockup
  /client
  /server
```

## Resume Protocol
1. Open `STATUS.md`.
2. Start from the first item under `Next Actions`.
3. If repo state differs from `STATUS.md`, correct `STATUS.md` before continuing.
4. At session end, update `STATUS.md` so the next session can resume immediately.
