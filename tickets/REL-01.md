# REL-01 Browser-Assisted Render Cold-Start Recovery

## State

In progress (implementation complete; awaiting review and production verification).

## Goal

Recover production startup when the free Render API is asleep and the Cloudflare Worker's server-side wake request receives a managed challenge, without spending extra Render hours on a keep-warm schedule.

## Scope

- Add a browser-side wake beacon to the public Render health endpoint.
- Trigger the wake only after a retryable readiness failure; stop it on success, abort, or completion.
- Thread an optional `VITE_API_WAKE_URL` from build configuration through the startup gate and axios availability layer.
- Update startup recovery copy to describe the wake behavior.
- Add focused tests for the wake helper, readiness integration, availability pass-through, URL resolution, and gate wiring.
- Add `VITE_API_WAKE_URL` to the production client build.

## Out of scope

- Render plan, region, or instance changes.
- Keep-warm cron jobs or synthetic traffic schedules.
- Worker `/ready` or `/health` proxy changes.
- Authentication, database, or migration changes.
- Deployment or production configuration changes without explicit authorization.

## Acceptance criteria

- A readiness retry starts a deduplicated hidden iframe and `no-cors` fetch to the configured wake URL.
- No wake is started for an immediate success, a non-retryable readiness response, or offline startup.
- The wake iframe and fetch are cleaned up after success, abort, replacement, or 60 seconds.
- Production bundles use `https://replog-tracker.onrender.com/health` when `VITE_API_WAKE_URL` is absent.
- Startup failure UI explains that the server is waking and continues automatic retries.
- No regression in existing readiness, availability, startup gate, or API URL tests.

## Verification

- `npm test -w client -- wake-upstream api-readiness api-availability api-url api-startup-gate`
- `npm run check`
- Production cold-start probe: open `https://replog.zllt.workers.dev/` after the Render service is idle and confirm startup recovers without a manual Render visit.

## Stop conditions

- Any secret, token, or credentialed wake URL is required.
- The fix needs Worker egress, Render configuration, or a paid plan.
- Production verification requires bypassing an authorization or security control.
- Changes would touch unrelated Wave 3 branches or ticket scope.
