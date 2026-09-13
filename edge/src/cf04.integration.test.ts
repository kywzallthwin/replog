import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'

const appOrigin = 'https://replog.example.com'
const env = {
  API_UPSTREAM_ORIGIN: 'https://render.example.com',
  PUBLIC_APP_ORIGINS: appOrigin,
  EDGE_PROXY_SECRET: 'integration-secret',
  ASSETS: { fetch: vi.fn(async () => new Response('<html>RepLog</html>', { headers: { 'Content-Type': 'text/html' } })) },
}

afterEach(() => vi.restoreAllMocks())

describe('CF-04 cross-stack edge integration contract', () => {
  it('keeps SPA routes on assets and never serves upstream startup HTML', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Render startup</html>', { headers: { 'Content-Type': 'text/html' } }))

    const spa = await worker.fetch(new Request(`${appOrigin}/dashboard`), env)
    const api = await worker.fetch(new Request(`${appOrigin}/api/me`), env)

    expect(spa.headers.get('content-type')).toContain('text/html')
    expect(await api.json()).toEqual({ error: 'The RepLog service is temporarily unavailable', code: 'UPSTREAM_UNAVAILABLE', retryable: true })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('preserves auth cookies, redirects, status, and no-store headers', async () => {
    const upstream = new Response(null, { status: 302, headers: { Location: `${appOrigin}/login`, 'Set-Cookie': 'replog_token=jwt; Path=/; HttpOnly; SameSite=Lax' } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstream)

    const response = await worker.fetch(new Request(`${appOrigin}/api/auth/google/callback?code=test`), env)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(`${appOrigin}/login`)
    expect(response.headers.get('Set-Cookie')).toContain('replog_token=jwt')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('dispatches a representative mutation exactly once', async () => {
    const requests: Request[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (request) => {
      const normalizedRequest = request instanceof Request ? request : new Request(request)
      requests.push(normalizedRequest)
      if (new URL(normalizedRequest.url).pathname === '/ready') return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } })
      return new Response('{"id":"session-1"}', { status: 201, headers: { 'Content-Type': 'application/json' } })
    })

    const response = await worker.fetch(new Request(`${appOrigin}/api/sessions`, { method: 'POST' }), env)

    expect(response.status).toBe(201)
    expect(requests).toHaveLength(1)
    expect(await response.json()).toEqual({ id: 'session-1' })
  })

  it('returns a retryable readiness response without exposing Render HTML', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Starting</html>', { headers: { 'Content-Type': 'text/html' } }))

    const response = await worker.fetch(new Request(`${appOrigin}/ready`), env)

    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('5')
    expect(await response.json()).toEqual({ ok: false, code: 'API_STARTING' })
  })
})
