import { describe, expect, it, vi } from 'vitest'
import { resolveApiReadinessUrl, waitForApiReadiness } from '../lib/apiReadiness'

const readyResponse = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })

describe('API readiness', () => {
  it('resolves the database-backed readiness endpoint', () => {
    expect(resolveApiReadinessUrl('/api')).toBe('/ready')
    expect(resolveApiReadinessUrl('https://api.example.com/service/api')).toBe('https://api.example.com/service/ready')
  })

  it('uses no-store and retries failures before succeeding', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('cold start')).mockResolvedValueOnce(readyResponse())
    const sleep = vi.fn().mockResolvedValue(undefined)

    await waitForApiReadiness({ apiBaseUrl: '/api', fetchImpl, sleep, delayMs: 5 })

    expect(fetchImpl).toHaveBeenLastCalledWith('/ready', expect.objectContaining({ cache: 'no-store' }))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('continues retrying rapid failures until the deadline', async () => {
    let clock = 0
    const fetchImpl = vi.fn().mockRejectedValue(new Error('not ready'))
    const sleep = vi.fn(async (delayMs: number) => {
      clock += delayMs
    })

    await expect(waitForApiReadiness({
      apiBaseUrl: '/api',
      attempts: 1,
      delayMs: 10,
      maxWaitMs: 50,
      fetchImpl,
      sleep,
      now: () => clock,
    })).rejects.toThrow('not ready')

    expect(fetchImpl).toHaveBeenCalledTimes(5)
  })

  it('bounds hanging attempts by the total deadline', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    const promise = waitForApiReadiness({ apiBaseUrl: '/api', attempts: 20, timeoutMs: 100, maxWaitMs: 250, delayMs: 100, fetchImpl })
    const rejection = expect(promise).rejects.toThrow(/timed out/)
    await vi.runAllTimersAsync()
    await rejection
    expect(fetchImpl.mock.calls.length).toBeLessThan(20)
    vi.useRealTimers()
  })

  it('propagates caller cancellation', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    const promise = waitForApiReadiness({ apiBaseUrl: '/api', signal: controller.signal, fetchImpl })
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})
