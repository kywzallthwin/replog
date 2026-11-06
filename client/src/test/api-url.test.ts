import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl, resolveWakeUrl } from '../lib/api'

describe('resolveApiBaseUrl', () => {
  it('normalizes configured URLs and preserves path prefixes', () => {
    expect(resolveApiBaseUrl(' https://api.example.com/api/api/// ', true)).toBe('https://api.example.com/api')
    expect(resolveApiBaseUrl('https://api.example.com/service', false)).toBe('https://api.example.com/service/api')
  })

  it('keeps the documented fallbacks', () => {
    expect(resolveApiBaseUrl(undefined, true)).toBe('/api')
    expect(resolveApiBaseUrl(undefined, false, 'http://workstation.test:4000')).toBe('http://workstation.test:4000/api')
    expect(resolveApiBaseUrl(undefined, false)).toBe('http://localhost:4000/api')
  })

  it.each([
    'not-a-url',
    '/api',
    'ftp://api.example.com',
    'https://user:password@example.com',
    'https://api.example.com?token=secret',
    'https://api.example.com/#fragment',
  ])('rejects invalid configured URL %s', (url) => {
    expect(() => resolveApiBaseUrl(url, false)).toThrow()
  })

  it('requires HTTPS for configured production URLs', () => {
    expect(() => resolveApiBaseUrl('http://api.example.com', true)).toThrow(/HTTPS/)
  })
})

describe('resolveWakeUrl', () => {
  it('uses a valid configured wake URL', () => {
    expect(resolveWakeUrl(' https://wake.example.test/health ', false)).toBe('https://wake.example.test/health')
  })

  it('falls back to the production Render health check only in production', () => {
    expect(resolveWakeUrl(undefined, true)).toBe('https://replog-tracker.onrender.com/health')
    expect(resolveWakeUrl(undefined, false)).toBeUndefined()
  })

  it.each([
    'not-a-url',
    '/health',
    'ftp://wake.example.test/health',
    'https://user:password@wake.example.test/health',
  ])('ignores invalid configured wake URL %s', (url) => {
    expect(resolveWakeUrl(url, false)).toBeUndefined()
    expect(resolveWakeUrl(url, true)).toBe('https://replog-tracker.onrender.com/health')
  })

  it('requires HTTPS for configured wake URLs in production', () => {
    expect(resolveWakeUrl('http://wake.example.test/health', true)).toBe('https://replog-tracker.onrender.com/health')
    expect(resolveWakeUrl('http://localhost:4000/health', false)).toBe('http://localhost:4000/health')
  })
})
