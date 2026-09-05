# RepLog Agent Rules

## Authority
- `STATUS.md` is the live handoff and active-ticket pointer.
- `WAVE1.md` is the current wave index; unfinished ticket requirements are in `tickets/`.
- `ROADMAP.md` is the high-level delivery plan and product-decision record.
- `Replog-mockup/Replog-mockup.html` and `Replog-Build-Plan.pdf` are UI/build references.
- `package.json` is the workspace and command source.

## Context
- Before editing, read `STATUS.md` and only the linked active ticket.
- Do not read every ticket or the complete roadmap by default.
- Read `ROADMAP.md` only for product decisions or wave planning.
- Read the mockup/PDF only for relevant structural UI work.
- Read `package-lock.json` only when dependencies change.
- Use targeted searches and file ranges instead of opening large files.
- Run focused verification while developing and the full ticket check once.

## Delivery
- Implement one coherent ticket at a time; do not expand scope silently.
- Mobile-first is required; treat 375px as the primary acceptance width.
- Preserve the mockup's structure and intent.
- Prefer small, independently verifiable changes.
- Do not begin a later wave until the current wave gate is complete.
- High-risk database, authentication, privacy, security, and deployment work needs explicit dependencies, risks, rollback considerations, and independent review.
- Preserve unrelated worktree changes.
- Do not commit, amend, push, or deploy without explicit user authorization.

## Tickets And Handoff
- Normal multi-step work requires a ticket with State, Goal, Scope, Out of scope, Acceptance criteria, Verification, and Stop conditions.
- Tiny, low-risk fixes may use a bounded prompt if independently verifiable.
- Run ticket verification before marking work `review` or `done`.
- Keep `STATUS.md` current; replace stale entries instead of appending history.
