import { describe, expect, it, vi } from 'vitest'
const workerModulePath = './index.ts'
const { default: worker, isProxyPath, parseOrigin } = await import(workerModulePath)

const env = { API_UPSTREAM_ORIGIN: 'https://api.example.com', PUBLIC_APP_ORIGINS: 'https://app.example.com', EDGE_PROXY_SECRET: 'secret', ASSETS: { fetch: async () => new Response('asset') } }

describe('edge routing and validation', () => {
  it('matches only approved proxy routes', () => {
    expect(isProxyPath('/api')).toBe(true); expect(isProxyPath('/api/x')).toBe(true); expect(isProxyPath('/ready')).toBe(true)
    expect(isProxyPath('/api%2Fx')).toBe(false); expect(isProxyPath('/apiary')).toBe(false); expect(isProxyPath('/health')).toBe(false)
  })
  it('requires a credential-free HTTPS origin', () => {
    expect(parseOrigin('https://api.example.com')).not.toBeNull()
    expect(parseOrigin('http://api.example.com')).toBeNull(); expect(parseOrigin('https://a.example/x')).toBeNull(); expect(parseOrigin('https://u:p@a.example')).toBeNull()
  })
  it('does not proxy unknown paths', async () => {
    const response = await worker.fetch(new Request('https://app.example.com/dashboard'), env)
    expect(await response.text()).toBe('asset')
  })
  it('rejects unapproved origins before upstream access', async () => {
    const response = await worker.fetch(new Request('https://preview.example.com/api'), env)
    expect(response.status).toBe(503); expect((await response.json() as { code: string }).code).toBe('PREVIEW_API_DISABLED')
  })
  it('forwards the approved URL and trusted headers only', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } }))
    const request = new Request('https://app.example.com/api/items?x=1', { headers: { Origin: 'https://app.example.com', 'X-Forwarded-For': 'spoof', 'CF-Connecting-IP': '203.0.113.4', 'CF-Ray': 'abc/123' } })
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    const upstream = fetcher.mock.calls[0][0] as Request
    expect(upstream.url).toBe('https://api.example.com/api/items?x=1')
    expect(upstream.headers.get('Origin')).toBe('https://app.example.com')
    expect(upstream.headers.get('X-Forwarded-For')).toBe('203.0.113.4')
    expect(upstream.headers.get('X-Request-ID')).toBe('cf-abc123')
    expect(upstream.headers.get('X-Edge-Proxy-Secret')).toBe('secret')
    expect(upstream.headers.get('X-Real-IP')).toBeNull()
    fetcher.mockRestore()
  })
  it('rejects invalid readiness responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":false,"extra":1}', { headers: { 'Content-Type': 'application/json' } }))
    const response = await worker.fetch(new Request('https://app.example.com/ready'), env)
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('5')
    expect(await response.json()).toEqual({ ok: false, code: 'API_STARTING' })
    vi.restoreAllMocks()
  })
  it('accepts compatible readiness responses with optional fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true,"runId":"test-run"}', { headers: { 'Content-Type': 'application/json' } }))
    const response = await worker.fetch(new Request('https://app.example.com/ready'), env)
    expect(response.status).toBe(200)
    vi.restoreAllMocks()
  })
  it('logs sanitized upstream diagnostics for a timeout', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('aborted', 'AbortError'))
    const response = await worker.fetch(new Request('https://app.example.com/ready', { headers: { 'CF-Ray': 'safe-id', Cookie: 'session=secret' } }), env)
    expect(response.status).toBe(504)
    const record = JSON.parse(String(warn.mock.calls[0][0])) as Record<string, unknown>
    expect(record).toMatchObject({ event: 'upstream_failure', requestId: 'cf-safe-id', status: 504, category: 'timeout' })
    expect(record).toHaveProperty('durationMs')
    expect(JSON.stringify(record)).not.toMatch(/secret|cookie|database/i)
    vi.restoreAllMocks()
  })
})
