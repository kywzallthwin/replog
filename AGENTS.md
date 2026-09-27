# RepLog Agent Rules

## Authority
- `STATUS.md` is the live handoff and active-ticket pointer.
- `WAVE2.md` is the current wave index; unfinished ticket requirements are in `tickets/`.
- `tickets/CF-00.md` is the active Cloudflare migration index; CF-01 through CF-05 are its bounded implementation tickets.
- `ROADMAP.md` is the high-level delivery plan and product-decision record.
- `Replog-mockup/Replog-mockup.html` and `Replog-Build-Plan.pdf` are UI/build references.
- `package.json` is the workspace and command source.

## Context
- Before editing, read `STATUS.md` and only the linked active ticket.
- For Cloudflare work, also read `tickets/CF-00.md` as the shared contract; do not read other CF tickets unless they are active or directly required for review.
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
- Wave 2 product work is paused while the Cloudflare migration initiative is active; do not activate W2-02 or later W2 tickets during CF-01 through CF-05.
- High-risk database, authentication, privacy, security, and deployment work needs explicit dependencies, risks, rollback considerations, and independent review.
- Preserve unrelated worktree changes.
- Do not commit, amend, push, or deploy without explicit user authorization.

## Multi-Agent Coordination

- Delegation remains bounded by the active ticket; it does not authorize starting another ticket or later-wave work.
- Every agent assignment must state its goal, owned files, read-only dependencies, verification, and stop conditions.
- Only one agent may edit a given file at a time.
- Preserve unrelated user or agent changes; do not revert, overwrite, format, or clean files outside assigned ownership.
- The coordinator owns `STATUS.md`, wave indexes, ticket states, and final integration while multiple agents are involved.
- Review agents are read-only unless explicitly assigned a follow-up fix.
- Implementers report completion and evidence; they do not independently mark tickets `review` or `done`.
- Implementers run focused checks; the coordinator runs the full ticket check once after integration.
- If work outside the active ticket is discovered, stop and report the dependency instead of expanding scope.

## Cloudflare Migration Coordination

- Treat `tickets/CF-00.md` as the shared architecture and security contract.
- Execute CF tickets sequentially: CF-01, CF-02, CF-03, CF-04, then CF-05.
- Do not activate multiple CF implementation tickets at once.
- CF-05 requires explicit deployment authorization and independent security/deployment review.
- Cloudflare, Render, DNS, OAuth, secret, and production configuration changes are prohibited until CF-05 is active and authorized.

## Tickets And Handoff
- Normal multi-step work requires a ticket with State, Goal, Scope, Out of scope, Acceptance criteria, Verification, and Stop conditions.
- Tiny, low-risk fixes may use a bounded prompt if independently verifiable.
- Run ticket verification before marking work `review` or `done`.
- Keep `STATUS.md` current; replace stale entries instead of appending history.
