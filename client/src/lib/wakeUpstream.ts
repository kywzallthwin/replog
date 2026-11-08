const WAKE_LIFETIME_MS = 60_000

export type UpstreamWakeHandle = {
  stop: () => void
}

type WakeUpstreamOptions = {
  fetchImpl?: typeof fetch
  webSocketImpl?: typeof WebSocket
  setTimeoutImpl?: typeof setTimeout
  clearTimeoutImpl?: typeof clearTimeout
}

type ActiveWake = {
  url: string
  handle: UpstreamWakeHandle
}

let activeWake: ActiveWake | null = null

function noop() {
  return undefined
}

function resolveWebSocketUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol === 'https:') {
      parsedUrl.protocol = 'wss:'
    } else if (parsedUrl.protocol === 'http:') {
      parsedUrl.protocol = 'ws:'
    } else {
      return undefined
    }
    return parsedUrl.toString()
  } catch {
    return undefined
  }
}

export function wakeUpstream(url: string | undefined, options: WakeUpstreamOptions = {}): UpstreamWakeHandle {
  if (!url) {
    return { stop: noop }
  }

  if (activeWake?.url === url) {
    return activeWake.handle
  }
  activeWake?.handle.stop()

  const fetchImpl = options.fetchImpl ?? fetch
  const WebSocketImpl = options.webSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined)
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout
  const controller = new AbortController()
  let socket: WebSocket | undefined
  let stopped = false

  const handle: UpstreamWakeHandle = {
    stop: () => {
      if (stopped) return
      stopped = true
      clearTimeoutImpl(timer)
      controller.abort()
      socket?.close()
      if (activeWake?.handle === handle) activeWake = null
    },
  }

  const webSocketUrl = resolveWebSocketUrl(url)
  if (webSocketUrl && WebSocketImpl) {
    try {
      socket = new WebSocketImpl(webSocketUrl)
      socket.addEventListener('open', () => socket?.close())
      socket.addEventListener('error', () => socket?.close())
    } catch {
      socket = undefined
    }
  }

  const timer = setTimeoutImpl(handle.stop, WAKE_LIFETIME_MS)

  try {
    void fetchImpl(url, {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    }).catch(noop)
  } catch {
    noop()
  }

  activeWake = { url, handle }
  return handle
}

export function stopUpstreamWake() {
  activeWake?.handle.stop()
}
