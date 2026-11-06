import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stopUpstreamWake, wakeUpstream } from '../lib/wakeUpstream'

const wakeUrl = 'https://wake.example.test/health'
const wakeIframes = () => document.querySelectorAll<HTMLIFrameElement>('iframe[data-replog-wake-upstream]')

describe('wakeUpstream', () => {
  beforeEach(() => {
    stopUpstreamWake()
  })

  afterEach(() => {
    stopUpstreamWake()
    wakeIframes().forEach((iframe) => iframe.remove())
    vi.useRealTimers()
  })

  it('does nothing without a wake URL', () => {
    const fetchImpl = vi.fn()
    const handle = wakeUpstream(undefined, { fetchImpl })

    handle.stop()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(wakeIframes()).toHaveLength(0)
  })

  it('starts one hidden iframe and one no-cors fetch', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())

    const handle = wakeUpstream(wakeUrl, { fetchImpl })
    const iframe = wakeIframes()[0]

    expect(wakeIframes()).toHaveLength(1)
    expect(iframe.src).toBe(wakeUrl)
    expect(iframe.tabIndex).toBe(-1)
    expect(iframe.getAttribute('aria-hidden')).toBe('true')
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(iframe.style.visibility).toBe('hidden')
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl).toHaveBeenCalledWith(wakeUrl, expect.objectContaining({
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
    }))

    handle.stop()
    expect(wakeIframes()).toHaveLength(0)
  })

  it('deduplicates repeated wakes for the same URL', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())

    const first = wakeUpstream(wakeUrl, { fetchImpl })
    const second = wakeUpstream(wakeUrl, { fetchImpl })

    expect(second).toBe(first)
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(wakeIframes()).toHaveLength(1)

    first.stop()
  })

  it('replaces an active wake for a different URL', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())
    const first = wakeUpstream(wakeUrl, { fetchImpl })
    const firstIframe = wakeIframes()[0]
    const secondUrl = 'https://wake.example.test/other'

    const second = wakeUpstream(secondUrl, { fetchImpl })

    expect(second).not.toBe(first)
    expect(firstIframe.isConnected).toBe(false)
    expect(wakeIframes()).toHaveLength(1)
    expect(wakeIframes()[0].src).toBe(secondUrl)
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    second.stop()
  })

  it('aborts the fetch and removes the iframe when stopped', () => {
    let requestInit: RequestInit | undefined
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init
      return new Promise<Response>(() => undefined)
    })

    const handle = wakeUpstream(wakeUrl, { fetchImpl })

    expect(requestInit?.signal?.aborted).toBe(false)
    handle.stop()
    expect(requestInit?.signal?.aborted).toBe(true)
    expect(wakeIframes()).toHaveLength(0)
  })

  it('cleans itself up after its lifetime', () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn().mockResolvedValue(new Response())
    let requestInit: RequestInit | undefined
    fetchImpl.mockImplementation((_url: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init
      return new Promise<Response>(() => undefined)
    })

    wakeUpstream(wakeUrl, { fetchImpl })
    expect(wakeIframes()).toHaveLength(1)

    vi.advanceTimersByTime(60_000)

    expect(wakeIframes()).toHaveLength(0)
    expect(requestInit?.signal?.aborted).toBe(true)
  })

  it('ignores a rejected wake fetch', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('blocked'))
    const handle = wakeUpstream(wakeUrl, { fetchImpl })

    await expect(Promise.resolve()).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledOnce()

    handle.stop()
  })
})
