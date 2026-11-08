# REL-01 Browser-Assisted Render Cold-Start Recovery

## State

In progress (WebSocket wake implementation; awaiting cold-start production verification).

## Goal

Recover production startup when the free Render API is asleep and the Cloudflare Worker's server-side wake request receives a managed challenge, without spending extra Render hours on a keep-warm schedule.

## Scope

- Add a browser-side WebSocket handshake to the public Render health endpoint, plus a `no-cors` fetch fallback.
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
- Render API restart/deploy triggers and Worker secrets unless the WebSocket wake fails cold-start verification and is separately authorized.
- Deployment or production configuration changes without explicit authorization.

## Acceptance criteria

- A readiness retry starts a deduplicated WebSocket handshake (`wss://…/health`) and a `no-cors` fetch to the configured wake URL.
- No wake is started for an immediate success, a non-retryable readiness response, or offline startup.
- The WebSocket and fetch are cleaned up after success, abort, replacement, or 60 seconds.
- WebSocket construction failures or unsupported browsers still attempt the fetch and never break startup.
- Production bundles use `https://replog-tracker.onrender.com/health` when `VITE_API_WAKE_URL` is absent.
- Startup failure UI explains that the server is waking and continues automatic retries.
- No regression in existing readiness, availability, startup gate, or API URL tests.

## Verification

- `npm test -w client -- wake-upstream api-readiness api-availability api-url api-startup-gate`
- `npm run check`
- Production cold-start probe: leave Render idle for 15+ minutes, then open `https://replog.zllt.workers.dev/` and confirm startup recovers without a manual Render visit or redeploy. Expect a WebSocket attempt to `wss://replog-tracker.onrender.com/health`, followed by `/ready` returning `200`.

## Stop conditions

- Any secret, token, or credentialed wake URL is required for the WebSocket path.
- The fix needs Worker egress, Render configuration, or a paid plan.
- Production verification requires bypassing an authorization or security control.
- The WebSocket handshake receives a Cloudflare challenge and does not wake the service; stop and request authorization for the Render API fallback.
- Changes would touch unrelated Wave 3 branches or ticket scope.
