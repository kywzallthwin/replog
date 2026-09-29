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

## Coordinated production deployment from `main`

The `deploy-production` job in `.github/workflows/ci.yml` runs after the unchanged `verify` job, and only for successful pushes to `main`. It checks out the exact verified commit, triggers Render with that commit SHA through the Render API, and polls for up to 30 minutes until the deployment is live or failed. It then verifies Render `/health`. Only after Render is live and healthy does it verify Cloudflare `/ready`, build `client/dist`, and deploy the Worker.

Render's `autoDeployTrigger` is set to `off` in `render.yaml`; GitHub Actions is the single deployment coordinator. Production concurrency is non-cancelling, so a running external Render deployment finishes before the next production deployment begins. The workflow prints the Git SHA, Render deploy ID, and Cloudflare Worker version when available.

Configure these GitHub Actions secrets for the repository or `production` environment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `RENDER_API_KEY`

Also configure the `production` environment variable `RENDER_SERVICE_ID`. The Render API derives the service's public URL for the health check, so no additional URL secret is required.

The Cloudflare token should be limited to the relevant account and Worker deployment permissions. The Render key should be limited to the required service deployment/read permissions. Runtime secrets such as `EDGE_PROXY_SECRET` remain in Cloudflare and are not passed to GitHub Actions. Pull requests and non-`main` pushes run CI only.

If verification fails, neither provider is deployed. If Render reports `failed`, `build_failed`, `pre_deploy_failed`, `update_failed`, `canceled`, or `deactivated`, or the 30-minute wait expires, Cloudflare remains on its previous version. If Render succeeds but Cloudflare fails, the previous Cloudflare version remains active and Render is not automatically rolled back; the workflow reports the partial deployment. Before merging this workflow, disable Render auto-deploy in the Render dashboard as well as in the Blueprint configuration.

If a deployment needs to be recovered manually, check out the intended `main` commit, provide the relevant credentials in the shell environment, and run the provider-specific commands below. Keep the Render deploy ID and Worker version in the recovery record.

```text
# Render: trigger the exact commit, then poll the returned deploy ID until live.
curl --request POST "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" \
  --header "Authorization: Bearer $RENDER_API_KEY" \
  --header "Content-Type: application/json" \
  --data "{\"commitId\":\"$(git rev-parse HEAD)\"}"

# Cloudflare: build and deploy the matching checked-out commit.
npm ci
npm run build -w client
npm run deploy -w edge
```

Do not print or echo either credential while running the recovery command.

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
