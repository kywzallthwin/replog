import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl } from '../lib/api'

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
