const WAKE_LIFETIME_MS = 60_000
const WAKE_IFRAME_ATTRIBUTE = 'data-replog-wake-upstream'

export type UpstreamWakeHandle = {
  stop: () => void
}

type WakeUpstreamOptions = {
  fetchImpl?: typeof fetch
  documentImpl?: Document
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

export function wakeUpstream(url: string | undefined, options: WakeUpstreamOptions = {}): UpstreamWakeHandle {
  if (!url) {
    return { stop: noop }
  }

  if (activeWake?.url === url) {
    return activeWake.handle
  }
  activeWake?.handle.stop()

  const documentImpl = options.documentImpl ?? (typeof document !== 'undefined' ? document : undefined)
  if (!documentImpl?.body) {
    return { stop: noop }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout
  const controller = new AbortController()
  let stopped = false

  const handle: UpstreamWakeHandle = {
    stop: () => {
      if (stopped) return
      stopped = true
      clearTimeoutImpl(timer)
      controller.abort()
      iframe.remove()
      if (activeWake?.handle === handle) activeWake = null
    },
  }

  const iframe = documentImpl.createElement('iframe')
  iframe.src = url
  iframe.title = 'RepLog server wake-up'
  iframe.tabIndex = -1
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('referrerpolicy', 'no-referrer')
  iframe.setAttribute(WAKE_IFRAME_ATTRIBUTE, 'true')
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden'
  documentImpl.body.appendChild(iframe)

  const timer = setTimeoutImpl(handle.stop, WAKE_LIFETIME_MS)

  void fetchImpl(url, {
    mode: 'no-cors',
    cache: 'no-store',
    credentials: 'omit',
    signal: controller.signal,
  }).catch(noop)

  activeWake = { url, handle }
  return handle
}

export function stopUpstreamWake() {
  activeWake?.handle.stop()
}
