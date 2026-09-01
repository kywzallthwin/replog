# RepLog Roadmap

This file is the high-level delivery plan. Detailed work belongs in the
current wave file named by `STATUS.md`. Each implementation session handles
one coherent ticket.

## Product Decisions

- Registration is public at launch.
- Weight is stored canonically in kilograms and converted for pound display.
- Account deletion will be immediate and permanent.
- Mobile-first acceptance uses a 375px phone layout as the primary target.
- Production deployment remains one Render Free Web Service with Neon Free PostgreSQL.

## Current State

- Phases 0-3 are complete and the MVP is deployed.
- Wave 1 is active: mobile acceptance and frontend quality.
- `WAVE1.md` is the canonical source for Wave 1 tickets and their states.
- Phase 4 work must not begin until the Wave 1 mobile gate is complete.

## Waves

### Wave 1: Mobile Acceptance And Frontend Quality

Audit and polish the existing application at 375px, improve shared
accessibility behavior, add client/browser test foundations, and close the
mobile acceptance gate without adding later product features.

Depends on: current deployed MVP and local verification environment.
Detailed tickets: `WAVE1.md`.

### Wave 2: Mockup Feature Completion

Implement the remaining mockup behavior: workout-level notes, always-visible
previous-workout references, enhanced rest timers, active-workout exercise
reordering, whole-day reordering, custom exercise editing/deletion, completed
workout deletion, kg/lb preferences, the SVG progress chart, and `/guide`.

Depends on: Wave 1 mobile and frontend quality gate.

### Wave 3: Public Authentication Hardening

Add email verification, resend verification, public-registration abuse
controls, persistent rate limiting, production Google OAuth, password-reset
email delivery, and an explicit authenticated Google account-linking flow.

Depends on: Wave 1 quality foundation and approved authentication decisions.

### Wave 4: Privacy And Account Lifecycle

Add Terms and Privacy pages, policy-version consent, data export, immediate
permanent account deletion, custom-exercise cleanup, and privacy-focused tests.

Depends on: Wave 3 authentication and verified account identity.

### Wave 5: Backend Integrity And Scale

Resolve ordering and check-then-write races, add database constraints,
protect finished workouts from concurrent edits, add idempotency for critical
mutations, paginate history, and move suitable aggregates into database
queries.

Depends on: stable API contracts and the account/data model from Waves 2-4.

### Wave 6: Client Reliability And Performance

Improve cold-start and network-error handling, distinguish `401` from service
outages, protect local storage access, add mutation recovery, lazy-load routes,
and reduce the client bundle warning.

Depends on: stable API behavior and critical mutation idempotency.

### Wave 7: Security And Operations

Triage dependency advisories, add dependency and security scanning, pin JWT
verification claims, add structured redacted logs, request IDs, error
monitoring, readiness alerts, backup/restore procedures, and incident
runbooks. Staging and launch acceptance remain in Wave 8.

Depends on: public authentication and account lifecycle being defined.

### Wave 8: Staging And Public Launch

Create isolated staging services and credentials, run full browser and
accessibility acceptance, verify mobile browsers, perform a restore drill,
test rollback procedures, and deploy only after the launch gate passes.

Depends on: Waves 1-7 and explicit user authorization to deploy.

## Phase Gates

- A wave is complete only when its tickets are reviewed, verified, and marked
  `done` in the wave file.
- `STATUS.md` must identify the active or next ticket after every session.
- High-risk database, authentication, privacy, security, and deployment work
  requires independent review before it is accepted.
- No production deployment occurs without explicit user authorization.

## Definition Of Done

RepLog is ready for a broad public launch when the mockup features are
complete, public authentication is verified, privacy controls are live,
critical client and server paths are tested, accessibility and responsive
acceptance passes, known production security findings are handled, and
staging, monitoring, backup, and rollback procedures have been exercised.
