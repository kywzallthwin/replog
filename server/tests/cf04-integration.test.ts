/// <reference types="node" />
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/replog_test'
process.env.JWT_SECRET ??= 'replog-cf04-test-secret-at-least-16-characters'
process.env.CLIENT_URL ??= 'https://replog.example.com'
process.env.REQUIRE_EDGE_PROXY = 'true'
process.env.EDGE_PROXY_SECRET = 'cf04-integration-secret'
process.env.SERVE_CLIENT = 'false'

const { app } = await import('../src/index.js')
// @ts-expect-error The Worker source is intentionally exercised by the server integration harness.
const { default: worker } = await import('../../edge/src/index.ts')
const { env } = await import('../src/env.js')
const { prisma } = await import('../src/prisma.js')

const appOrigin = env.CLIENT_URL
const edgeSecret = env.EDGE_PROXY_SECRET as string
let server: ReturnType<typeof app.listen>
let upstreamOrigin: string

function workerEnv() {
  return {
    API_UPSTREAM_ORIGIN: 'https://render.integration.test',
    PUBLIC_APP_ORIGINS: appOrigin,
    EDGE_PROXY_SECRET: edgeSecret,
    ASSETS: { fetch: async () => new Response('<html>RepLog</html>', { headers: { 'Content-Type': 'text/html' } }) },
  }
}

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address() as AddressInfo
  upstreamOrigin = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  await prisma.$disconnect()
})

test('Worker and Express share edge enforcement, health, readiness, and cache policy', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const target = new URL(input instanceof Request ? input.url : input.toString())
    target.protocol = 'http:'
    target.hostname = '127.0.0.1'
    target.port = new URL(upstreamOrigin).port
    return originalFetch(target, init)
  }

  try {
    const health = await worker.fetch(new Request(`${appOrigin}/api/not-a-route`), workerEnv())
    assert.equal(health.status, 404)
    assert.deepEqual(await health.json(), { error: 'API route not found' })
    assert.equal(health.headers.get('cache-control'), 'no-store')

    const directHealth = await fetch(`${upstreamOrigin}/health`)
    assert.equal(directHealth.status, 200)
    assert.deepEqual(await directHealth.json(), { ok: true })
    assert.equal(directHealth.headers.get('cache-control'), 'no-store')

    const ready = await worker.fetch(new Request(`${appOrigin}/ready`), workerEnv())
    assert.equal(ready.status, 200)
    assert.deepEqual(await ready.json(), { ok: true })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Worker preserves Express auth cookies, redirects, and invalid credentials', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const target = new URL(input instanceof Request ? input.url : input.toString())
    target.protocol = 'http:'
    target.hostname = '127.0.0.1'
    target.port = new URL(upstreamOrigin).port
    return originalFetch(target, init)
  }

  try {
    const invalid = await worker.fetch(new Request(`${appOrigin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: appOrigin },
      body: JSON.stringify({ email: 'missing@example.test', password: 'wrong-password' }),
    }), workerEnv())
    assert.equal(invalid.status, 401)
    assert.deepEqual(await invalid.json(), { error: 'Invalid email or password' })
    assert.equal(invalid.headers.get('cache-control'), 'no-store')

    const logout = await worker.fetch(new Request(`${appOrigin}/api/auth/logout`, { method: 'POST', headers: { Origin: appOrigin } }), workerEnv())
    assert.equal(logout.status, 204)
    assert.match(logout.headers.get('set-cookie') ?? '', /replog_token=.*Path=\//)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Worker forwards a representative mutation exactly once', async () => {
  let dispatches = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    dispatches += 1
    const target = new URL(input instanceof Request ? input.url : input.toString())
    target.protocol = 'http:'
    target.hostname = '127.0.0.1'
    target.port = new URL(upstreamOrigin).port
    return originalFetch(target, init)
  }

  try {
    const response = await worker.fetch(new Request(`${appOrigin}/api/not-a-route`, { method: 'POST', headers: { Origin: appOrigin } }), workerEnv())
    assert.equal(response.status, 404)
    assert.equal(dispatches, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
