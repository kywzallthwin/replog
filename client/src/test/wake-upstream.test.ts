import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stopUpstreamWake, wakeUpstream } from '../lib/wakeUpstream'

const wakeUrl = 'https://wake.example.test/health'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  readonly url: string
  closed = false
  private listeners = new Map<string, Array<() => void>>()

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  close() {
    this.closed = true
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener()
  }
}

const fakeWebSocket = () => FakeWebSocket as unknown as typeof WebSocket

describe('wakeUpstream', () => {
  beforeEach(() => {
    stopUpstreamWake()
    FakeWebSocket.instances = []
  })

  afterEach(() => {
    stopUpstreamWake()
    vi.useRealTimers()
  })

  it('does nothing without a wake URL', () => {
    const fetchImpl = vi.fn()

    const handle = wakeUpstream(undefined, { fetchImpl, webSocketImpl: fakeWebSocket() })

    handle.stop()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('starts one WebSocket handshake and one no-cors fetch', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())

    const handle = wakeUpstream(wakeUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].url).toBe('wss://wake.example.test/health')
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl).toHaveBeenCalledWith(wakeUrl, expect.objectContaining({
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
    }))

    handle.stop()
  })

  it('converts HTTP wake URLs to WebSocket URLs', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())

    const handle = wakeUpstream('http://localhost:4000/health', {
      fetchImpl,
      webSocketImpl: fakeWebSocket(),
    })

    expect(FakeWebSocket.instances[0].url).toBe('ws://localhost:4000/health')

    handle.stop()
  })

  it('skips the WebSocket for non-HTTP wake URLs', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())

    const handle = wakeUpstream('data:text/plain,hello', { fetchImpl, webSocketImpl: fakeWebSocket() })

    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(fetchImpl).toHaveBeenCalledOnce()

    handle.stop()
  })

  it('deduplicates repeated wakes for the same URL', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())

    const first = wakeUpstream(wakeUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })
    const second = wakeUpstream(wakeUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })

    expect(second).toBe(first)
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledOnce()

    first.stop()
  })

  it('replaces an active wake for a different URL', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())
    const first = wakeUpstream(wakeUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })
    const firstSocket = FakeWebSocket.instances[0]
    const secondUrl = 'https://wake.example.test/other'

    const second = wakeUpstream(secondUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })

    expect(second).not.toBe(first)
    expect(firstSocket.closed).toBe(true)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(FakeWebSocket.instances[1].url).toBe('wss://wake.example.test/other')
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    second.stop()
  })

  it('closes the WebSocket and aborts the fetch when stopped', () => {
    let requestInit: RequestInit | undefined
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init
      return new Promise<Response>(() => undefined)
    })

    const handle = wakeUpstream(wakeUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })
    const socket = FakeWebSocket.instances[0]

    expect(socket.closed).toBe(false)
    expect(requestInit?.signal?.aborted).toBe(false)

    handle.stop()

    expect(socket.closed).toBe(true)
    expect(requestInit?.signal?.aborted).toBe(true)
  })

  it('closes the WebSocket after it opens or errors', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())

    const opened = wakeUpstream(wakeUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })
    FakeWebSocket.instances[0].emit('open')
    expect(FakeWebSocket.instances[0].closed).toBe(true)
    opened.stop()

    const errored = wakeUpstream(wakeUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })
    FakeWebSocket.instances[1].emit('error')
    expect(FakeWebSocket.instances[1].closed).toBe(true)
    errored.stop()
  })

  it('cleans itself up after its lifetime', () => {
    vi.useFakeTimers()
    let requestInit: RequestInit | undefined
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init
      return new Promise<Response>(() => undefined)
    })

    wakeUpstream(wakeUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })
    const socket = FakeWebSocket.instances[0]

    expect(socket.closed).toBe(false)
    vi.advanceTimersByTime(60_000)

    expect(socket.closed).toBe(true)
    expect(requestInit?.signal?.aborted).toBe(true)
  })

  it('still attempts the fetch when the WebSocket cannot start', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response())
    class ThrowingWebSocket {
      constructor() {
        throw new Error('blocked')
      }
    }

    const handle = wakeUpstream(wakeUrl, {
      fetchImpl,
      webSocketImpl: ThrowingWebSocket as unknown as typeof WebSocket,
    })

    expect(fetchImpl).toHaveBeenCalledOnce()
    handle.stop()
  })

  it('ignores a rejected wake fetch', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('blocked'))
    const handle = wakeUpstream(wakeUrl, { fetchImpl, webSocketImpl: fakeWebSocket() })

    await expect(Promise.resolve()).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledOnce()

    handle.stop()
  })
})
