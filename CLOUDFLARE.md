# Cloudflare deployment and integration runbook

RepLog uses a Cloudflare Worker with Workers Static Assets for the React app. The Worker proxies only `/api`, `/api/*`, and `/ready` to the Render Express service. The Render service remains the API and owns the Neon database.

## Environment

| Component | Required values |
| --- | --- |
| Cloudflare Worker | `API_UPSTREAM_ORIGIN=https://<render-service>.onrender.com`, `PUBLIC_APP_ORIGINS=https://<app-host>`, `EDGE_PROXY_SECRET=<shared-random-secret>` |
| Render API | `CLIENT_URL=https://<app-host>`, `REQUIRE_EDGE_PROXY=true`, `EDGE_PROXY_SECRET=<same-secret>`, `SERVE_CLIENT=false`, production JWT and Neon URLs |
| OAuth | Google callback `https://<app-host>/api/auth/google/callback` and the same URL in `GOOGLE_CALLBACK_URL` |
| Reset email | `CLIENT_URL` is the public Cloudflare origin, so reset links point to `/reset-password` on that host |

Keep `VITE_API_URL` unset for the production client. Preview deployments must use an exact origin in `PUBLIC_APP_ORIGINS`; previews do not access production API data by default.

## Local Worker preview

```text
npm ci
npm run build
npm run dev -w server
npm run dev -w client
```

For a Worker preview, build the client first, start Express locally, and expose it through an HTTPS tunnel such as Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:4000`). Set the resulting HTTPS tunnel URL as `API_UPSTREAM_ORIGIN` in `.dev.vars`, set the Worker secret and exact preview origin, then run `npm run dev -w edge`. Plain `http://localhost:4000` is rejected by the Worker’s upstream-origin validation.

## Auth and cold-start checks

Run the focused contract tests with `npm test -w edge`, then the browser journey with `npm run test:e2e` against a designated test database. Verify registration, login, refresh, logout, reset links, and OAuth callback redirects all use the Cloudflare origin. During a cold start, `/ready` may return `{ "ok": false, "code": "API_STARTING" }`; the browser must continue showing RepLog UI and retry. A mutation must be dispatched once.

Confirm API, `/ready`, and `/health` responses have `Cache-Control: no-store`, auth cookies are host-only, HTTP-only, `Secure`, `SameSite=Lax`, and use their existing paths. Check logs by request ID and Cloudflare Ray ID; redact cookies, tokens, reset tokens, OAuth codes, and database URLs.

## Cutover and rollback

Before cutover, verify the custom hostname, DNS, Render origin, OAuth callback, Resend sender, Neon migrations, and real cold-start behavior. Roll back by directing the hostname to the prior Render-served frontend and restoring `SERVE_CLIENT=true`; keep the API and database credentials unchanged. Production deployment requires CF-05 authorization and an independent security/deployment review.
