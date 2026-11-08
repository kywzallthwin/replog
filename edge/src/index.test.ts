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
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true,"runId":"test-run"}', { headers: { 'Content-Type': 'application/json' } }))
    const response = await worker.fetch(new Request('https://app.example.com/ready'), env)
    expect(response.status).toBe(200)
    expect((fetcher.mock.calls[0][0] as Request).headers.get('Accept')).toBe('application/json')
    vi.restoreAllMocks()
  })
  it('returns 503 with Retry-After 15 and sanitized diagnostics for upstream 429 HTML challenges on /ready', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<!DOCTYPE html><html>challenge</html>', { status: 429, headers: { 'Content-Type': 'text/html; charset=UTF-8' } }))
    const response = await worker.fetch(new Request('https://app.example.com/ready', { headers: { Accept: 'text/html', 'CF-Ray': 'rate-id', Cookie: 'session=secret' } }), env)
    expect((fetcher.mock.calls[0][0] as Request).headers.get('Accept')).toBe('application/json')
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('15')
    expect(await response.json()).toEqual({ ok: false, code: 'API_STARTING' })
    const record = JSON.parse(String(warn.mock.calls[0][0])) as Record<string, unknown>
    expect(record).toMatchObject({ event: 'upstream_failure', requestId: 'cf-rate-id', status: 429, category: 'upstream_rate_limited' })
    expect(record).toHaveProperty('durationMs')
    expect(JSON.stringify(record)).not.toMatch(/secret|cookie|challenge/i)
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

  const wakeEnv = { ...env, RENDER_API_KEY: 'render-key', RENDER_SERVICE_ID: 'srv-test' }
  const browserHeaders = { 'Sec-Fetch-Site': 'same-origin', 'CF-Ray': 'wake-id' }

  it('requests a Render deploy-only wake and sets a dedupe cookie on /ready challenges', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      calls.push({ url, init })
      if (url.startsWith('https://api.render.com/')) return new Response('{}', { status: 202 })
      return new Response('<!DOCTYPE html><html>challenge</html>', { status: 429, headers: { 'Content-Type': 'text/html; charset=UTF-8' } })
    })
    const response = await worker.fetch(new Request('https://app.example.com/ready', { headers: browserHeaders }), wakeEnv)
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('15')
    expect(response.headers.get('Set-Cookie')).toContain('replog_wake=1')
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.com/ready',
      'https://api.render.com/v1/services/srv-test/deploys',
    ])
    expect(calls[1].init?.method).toBe('POST')
    expect(new Headers(calls[1].init?.headers).get('Authorization')).toBe('Bearer render-key')
    expect(new Headers(calls[1].init?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ deployMode: 'deploy_only' })
    expect(await response.json()).toEqual({ ok: false, code: 'API_STARTING' })
    const record = JSON.parse(String(warn.mock.calls[0][0])) as Record<string, unknown>
    expect(record).toMatchObject({ event: 'upstream_failure', requestId: 'cf-wake-id', status: 429, category: 'upstream_rate_limited' })
    expect(JSON.stringify(record)).not.toMatch(/render-key|srv-test/)
    vi.restoreAllMocks()
  })

  it('skips the Render wake when the wake cookie is present', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('challenge', { status: 429, headers: { 'Content-Type': 'text/html' } }))
    const response = await worker.fetch(new Request('https://app.example.com/ready', {
      headers: { ...browserHeaders, Cookie: 'replog_wake=1' },
    }), wakeEnv)
    expect(response.status).toBe(503)
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect((fetcher.mock.calls[0][0] as Request).url).toBe('https://api.example.com/ready')
    vi.restoreAllMocks()
  })

  it('falls back to a Render restart when the deploy-only wake fails', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      calls.push({ url, init })
      if (url.endsWith('/deploys')) return new Response('{}', { status: 503 })
      if (url.startsWith('https://api.render.com/')) return new Response('{}', { status: 200 })
      return new Response('<!DOCTYPE html><html>challenge</html>', { status: 429, headers: { 'Content-Type': 'text/html; charset=UTF-8' } })
    })
    const response = await worker.fetch(new Request('https://app.example.com/ready', { headers: browserHeaders }), wakeEnv)
    expect(response.status).toBe(503)
    expect(response.headers.get('Set-Cookie')).toContain('replog_wake=1')
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.com/ready',
      'https://api.render.com/v1/services/srv-test/deploys',
      'https://api.render.com/v1/services/srv-test/restart',
    ])
    expect(calls[1].init?.method).toBe('POST')
    expect(new Headers(calls[1].init?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ deployMode: 'deploy_only' })
    expect(calls[2].init?.method).toBe('POST')
    expect(new Headers(calls[2].init?.headers).get('Content-Type')).toBeNull()
    expect(new Headers(calls[2].init?.headers).get('Authorization')).toBe('Bearer render-key')
    vi.restoreAllMocks()
  })

  it('does not request a Render wake without a browser readiness request', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('challenge', { status: 429, headers: { 'Content-Type': 'text/html' } }))
    const response = await worker.fetch(new Request('https://app.example.com/ready', { headers: { 'CF-Ray': 'bot-id' } }), wakeEnv)
    expect(response.status).toBe(503)
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('does not request a Render wake when the Worker secrets are missing', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('challenge', { status: 429, headers: { 'Content-Type': 'text/html' } }))
    const response = await worker.fetch(new Request('https://app.example.com/ready', { headers: browserHeaders }), env)
    expect(response.status).toBe(503)
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('requests a Render wake when the /ready upstream times out', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      calls.push({ url, init })
      if (url.startsWith('https://api.render.com/')) return new Response('{}', { status: 200 })
      throw new DOMException('aborted', 'AbortError')
    })
    const response = await worker.fetch(new Request('https://app.example.com/ready', { headers: browserHeaders }), wakeEnv)
    expect(response.status).toBe(504)
    expect(response.headers.get('Set-Cookie')).toContain('replog_wake=1')
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.com/ready',
      'https://api.render.com/v1/services/srv-test/deploys',
    ])
    const record = JSON.parse(String(warn.mock.calls[0][0])) as Record<string, unknown>
    expect(record).toMatchObject({ event: 'upstream_failure', requestId: 'cf-wake-id', status: 504, category: 'timeout' })
    vi.restoreAllMocks()
  })

  it('requests a Render wake when /ready receives an HTML challenge page', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      calls.push({ url, init })
      if (url.startsWith('https://api.render.com/')) return new Response('{}', { status: 200 })
      return new Response('<!DOCTYPE html><html>waking</html>', { status: 503, headers: { 'Content-Type': 'text/html; charset=UTF-8' } })
    })
    const response = await worker.fetch(new Request('https://app.example.com/ready', { headers: browserHeaders }), wakeEnv)
    expect(response.status).toBe(503)
    expect(response.headers.get('Set-Cookie')).toContain('replog_wake=1')
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.com/ready',
      'https://api.render.com/v1/services/srv-test/deploys',
    ])
    vi.restoreAllMocks()
  })
})
