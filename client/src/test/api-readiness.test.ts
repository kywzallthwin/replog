import { describe, expect, it, vi } from 'vitest'
import { resolveApiHealthUrl, waitForApiReadiness } from '../lib/apiReadiness'

const readyResponse = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })

describe('API readiness', () => {
  it.each([
    ['/api', '/health'],
    [' https://api.example.com/api/// ', 'https://api.example.com/health'],
  ])('resolves %s to %s', (baseUrl, expected) => {
    expect(resolveApiHealthUrl(baseUrl)).toBe(expected)
  })

  it('succeeds immediately when the API is ready', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(readyResponse())

    await waitForApiReadiness({ apiBaseUrl: '/api', fetchImpl, delayMs: 0 })

    expect(fetchImpl).toHaveBeenCalledWith('/health', expect.anything())
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries failed and invalid health responses until ready', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('cold start'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: false }) })
      .mockResolvedValueOnce(readyResponse())
    const sleep = vi.fn().mockResolvedValue(undefined)

    await waitForApiReadiness({ apiBaseUrl: 'https://api.example.com/api', fetchImpl, sleep, delayMs: 10 })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('stops after the configured attempt limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ ok: false }) })

    await expect(waitForApiReadiness({ apiBaseUrl: '/api', attempts: 3, fetchImpl, sleep: vi.fn().mockResolvedValue(undefined) }))
      .rejects.toThrow('503')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('cancels a pending request and retry delay', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    const promise = waitForApiReadiness({ apiBaseUrl: '/api', fetchImpl, signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('supports a fresh manual retry after failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) }).mockResolvedValueOnce(readyResponse())

    await expect(waitForApiReadiness({ apiBaseUrl: '/api', attempts: 1, fetchImpl })).rejects.toThrow()
    await expect(waitForApiReadiness({ apiBaseUrl: '/api', attempts: 1, fetchImpl })).resolves.toBeUndefined()
  })

  it('retries an internal request timeout', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    const promise = waitForApiReadiness({ apiBaseUrl: '/api', attempts: 2, timeoutMs: 10, delayMs: 0, fetchImpl })
    const rejection = expect(promise).rejects.toThrow('timed out')
    await vi.runAllTimersAsync()
    await rejection
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
