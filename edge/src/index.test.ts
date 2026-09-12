import { describe, expect, it } from 'vitest'
import worker, { isProxyPath, parseOrigin } from './index'

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
})
