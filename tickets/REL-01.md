# REL-01 Browser-Assisted Render Cold-Start Recovery

## State

In progress (Worker Render restart/deploy wake support and one-click fallback; awaiting secret configuration and cold-start production verification). A real-browser WebSocket cold-start probe did not wake the spun-down service, so the WebSocket path remains best-effort only.

## Goal

Recover production startup when the free Render API is asleep and the Cloudflare Worker's server-side wake request receives a managed challenge, without spending extra Render hours on a keep-warm schedule.

## Scope

- Add a browser-side WebSocket handshake to the public Render health endpoint, plus a `no-cors` fetch fallback.
- Trigger the browser wake only after a retryable readiness failure; stop it on success, abort, or completion.
- Thread an optional `VITE_API_WAKE_URL` from build configuration through the startup gate and axios availability layer.
- Add a one-click `Wake server` link on the recovery card that opens the public wake URL in a new tab.
- Add optional Worker-side Render wake support: on browser `/ready` challenges, call Render's restart API, then a deploy-only deploy if restart fails.
- Dedupe Worker wakes with a short-lived `replog_wake` cookie and browser Fetch Metadata checks; skip silently when the Worker secrets are absent.
- Sync the existing `RENDER_API_KEY` and `RENDER_SERVICE_ID` GitHub values into Cloudflare Worker secrets during the deploy job without printing them.
- Update startup recovery copy to describe the wake behavior.
- Add focused tests for the wake helper, readiness integration, availability pass-through, URL resolution, gate wiring, and Worker wake behavior.
- Add `VITE_API_WAKE_URL` to the production client build.

## Out of scope

- Render plan, region, or instance changes.
- Keep-warm cron jobs or synthetic traffic schedules.
- Committing or exposing Render API keys; the deploy job copies the existing GitHub secret into a Cloudflare Worker secret.
- Authentication, database, or migration changes.
- Deployment or production configuration changes without explicit authorization.

## Acceptance criteria

- A readiness retry starts a deduplicated WebSocket handshake (`wss://…/health`) and a `no-cors` fetch to the configured wake URL.
- No browser wake is started for an immediate success, a non-retryable readiness response, or offline startup.
- The WebSocket and fetch are cleaned up after success, abort, replacement, or 60 seconds.
- WebSocket construction failures or unsupported browsers still attempt the fetch and never break startup.
- On a browser `/ready` 429, HTML challenge, or upstream timeout, the Worker calls `POST /v1/services/{id}/restart` when `RENDER_API_KEY` and `RENDER_SERVICE_ID` are configured, falls back to `POST /v1/services/{id}/deploys` with `deployMode: deploy_only`, and sets a 2-minute `replog_wake` cookie.
- The Worker does not wake for non-browser requests, cookie-bearing retries, preview origins, or missing secrets, and never logs the Render key or service ID.
- The recovery card offers a `Wake server` link with the configured wake URL when online.
- Production bundles use `https://replog-tracker.onrender.com/health` when `VITE_API_WAKE_URL` is absent.
- Startup failure UI explains that the server is waking and continues automatic retries.
- No regression in existing readiness, availability, startup gate, API URL, or edge Worker tests.

## Verification

- `npm test -w client -- wake-upstream api-readiness api-availability api-url api-startup-gate`
- `npm test -w edge`
- `npm run check`
- Confirm the deploy job sets the `RENDER_API_KEY` and `RENDER_SERVICE_ID` Worker secrets without printing their values.
- Production cold-start probe: leave Render idle for 15+ minutes, then open `https://replog.zllt.workers.dev/`. Confirm automatic recovery without a manual Render visit or redeploy. If automatic recovery fails, confirm the `Wake server` link wakes Render and the app recovers.

## Stop conditions

- Any secret, token, or credentialed wake URL is committed to the repository or exposed to the client.
- The fix needs Worker egress, Render configuration, or a paid plan beyond the authorized restart/deploy calls.
- Production verification requires bypassing an authorization or security control.
- Render restart/deploy cannot be authorized; ship the one-click fallback and mark automatic recovery blocked.
- Changes would touch unrelated Wave 3 branches or ticket scope.
