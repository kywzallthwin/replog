import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureApiAvailable,
  installApiAvailability,
  invalidateApiAvailability,
  isApiAvailabilityStale,
  markApiAvailable,
  resetApiAvailability,
} from '../lib/apiAvailability'
import { waitForApiReadiness } from '../lib/apiReadiness'

vi.mock('../lib/apiReadiness', () => ({ waitForApiReadiness: vi.fn() }))
const mockedReadiness = vi.mocked(waitForApiReadiness)

describe('API availability coordination', () => {
  beforeEach(() => {
    resetApiAvailability()
    mockedReadiness.mockReset().mockResolvedValue(undefined)
  })

  it('treats a successful clock value of zero as available', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    markApiAvailable()
    expect(isApiAvailabilityStale()).toBe(false)
    vi.restoreAllMocks()
  })

  it('shares one readiness run between concurrent stale callers', async () => {
    let resolve: () => void = () => undefined
    mockedReadiness.mockReturnValue(new Promise<void>((done) => { resolve = done }))

    const first = ensureApiAvailable(() => '/api')
    const second = ensureApiAvailable(() => '/api')

    expect(mockedReadiness).toHaveBeenCalledTimes(1)
    resolve()
    await Promise.all([first, second])
  })

  it('starts a fresh run instead of joining an aborted flight that has not settled', async () => {
    let oldSignal: AbortSignal | undefined
    mockedReadiness
      .mockImplementationOnce(({ signal }) => {
        oldSignal = signal
        return new Promise<void>(() => undefined)
      })
      .mockResolvedValueOnce(undefined)
    const abandonedController = new AbortController()
    const abandoned = ensureApiAvailable(() => '/api', abandonedController.signal)

    abandonedController.abort()
    await expect(abandoned).rejects.toMatchObject({ code: axios.AxiosError.ERR_CANCELED })
    await Promise.resolve()
    expect(oldSignal?.aborted).toBe(true)

    await ensureApiAvailable(() => '/api')
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
  })

  it('preflights stale mutations and never replays them', async () => {
    const instance = axios.create({ adapter: async (config) => {
      throw new axios.AxiosError('upstream unavailable', 'ERR_NETWORK', config)
    } })
    installApiAvailability(instance, () => '/api')

    await expect(instance.post('/write', { value: 1 })).rejects.toBeInstanceOf(axios.AxiosError)
    expect(mockedReadiness).toHaveBeenCalledTimes(1)
  })

  it('does not replay a dispatched mutation after an upstream failure', async () => {
    let calls = 0
    const instance = axios.create({ adapter: async (config) => {
      calls += 1
      throw new axios.AxiosError('upstream unavailable', 'ERR_NETWORK', config)
    } })
    installApiAvailability(instance, () => '/api')
    markApiAvailable()

    await expect(instance.post('/write', { value: 1 })).rejects.toBeInstanceOf(axios.AxiosError)
    expect(calls).toBe(1)
  })

  it('recovers a failed safe request once', async () => {
    let calls = 0
    const instance = axios.create({ adapter: async (config) => {
      calls += 1
      if (calls === 1) throw new axios.AxiosError('upstream unavailable', 'ERR_NETWORK', config)
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config }
    } })
    installApiAvailability(instance, () => '/api')

    await expect(instance.get('/read')).resolves.toMatchObject({ status: 200 })
    expect(calls).toBe(2)
    expect(mockedReadiness).toHaveBeenCalledTimes(1)
  })

  it('invalidates availability after a retryable safe-request failure', () => {
    markApiAvailable()
    expect(isApiAvailabilityStale()).toBe(false)
    invalidateApiAvailability()
    expect(isApiAvailabilityStale()).toBe(true)
  })
})
