import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl } from '../lib/api'

describe('resolveApiBaseUrl', () => {
  it('normalizes a configured URL for development and production', () => {
    expect(resolveApiBaseUrl(' https://api.example.com/ ', false)).toBe('https://api.example.com/api')
    expect(resolveApiBaseUrl('https://api.example.com/api/api///', true)).toBe('https://api.example.com/api')
  })

  it('uses the production same-origin API fallback when unset', () => {
    expect(resolveApiBaseUrl(undefined, true)).toBe('/api')
    expect(resolveApiBaseUrl('   ', true)).toBe('/api')
  })

  it('uses the browser hostname on port 4000 in development', () => {
    expect(resolveApiBaseUrl(undefined, false, 'https://example.test')).toBe('https://example.test/api')
    expect(resolveApiBaseUrl(undefined, false, 'http://localhost:4000/')).toBe('http://localhost:4000/api')
  })

  it('uses localhost outside the browser in development', () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe('http://localhost:4000/api')
  })
})
