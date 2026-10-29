import { useEffect, useState, type ReactNode } from 'react'
import { apiBaseUrl, apiConfigurationError } from '../../lib/api'
import { ensureApiAvailable } from '../../lib/apiAvailability'
import { BrandedLoader } from '../ui/BrandedLoader'

type ApiStartupGateProps = {
  children: ReactNode
  configurationError?: Error | null
}

export function ApiStartupGate({ children, configurationError = apiConfigurationError }: ApiStartupGateProps) {
  const [retryCount, setRetryCount] = useState(0)
  const [state, setState] = useState<'checking' | 'ready' | 'failed'>(() => navigator.onLine ? 'checking' : 'failed')
  const [showColdStartHint, setShowColdStartHint] = useState(false)
  const [announcement, setAnnouncement] = useState(() => navigator.onLine ? 'Starting RepLog' : 'Offline. Reconnect to continue startup.')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    if (configurationError || state !== 'checking' || showColdStartHint) return

    const coldStartTimer = setTimeout(() => {
      setShowColdStartHint(true)
    }, 3000)

    return () => clearTimeout(coldStartTimer)
  }, [configurationError, showColdStartHint, state])

  useEffect(() => {
    if (configurationError) return

    let active = true
    let startupComplete = false
    let sequenceStarted = false
    let inFlight = false
    let retryAfterCancellation = false
    let currentController: AbortController | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let stopStartupWatchers = () => undefined
    const retry = (manual = false) => {
      if (!active || startupComplete || document.visibilityState === 'hidden' || !navigator.onLine) return
      if (inFlight) {
        if (currentController?.signal.aborted) retryAfterCancellation = true
        return
      }
      inFlight = true
      if (manual) setState('checking')
      if (sequenceStarted) setAnnouncement('Retrying RepLog')
      sequenceStarted = true
      const controller = new AbortController()
      currentController = controller
      void ensureApiAvailable(() => apiBaseUrl, controller.signal).then(
        () => {
          if (active) {
            startupComplete = true
            stopStartupWatchers()
            setState('ready')
          }
        },
        () => {
          if (!active || controller.signal.aborted) return
          if (!navigator.onLine) { setState('failed'); return }
          setAnnouncement('RepLog unavailable. Retrying automatically.')
          setState('failed')
          retryTimer = setTimeout(() => retry(), 15000)
        },
      ).finally(() => {
        inFlight = false
        if (currentController === controller) currentController = undefined
        if (retryAfterCancellation) {
          retryAfterCancellation = false
          retry()
        }
      })
    }
    const onOnline = () => {
      setIsOnline(true)
      setAnnouncement('Retrying RepLog')
      retry()
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') retry() }
    const onOffline = () => {
      if (!active || startupComplete) return
      setIsOnline(false)
      setState('failed')
      setAnnouncement('Offline. Reconnect to continue startup.')
      retryAfterCancellation = false
      if (retryTimer) clearTimeout(retryTimer)
      currentController?.abort()
    }
    stopStartupWatchers = () => {
      if (retryTimer) clearTimeout(retryTimer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisibility)

    retry()

    return () => {
      active = false
      currentController?.abort()
      stopStartupWatchers()
    }
  }, [configurationError, retryCount])

  if (configurationError) {
    return (
      <main className="grid min-h-dvh place-content-center bg-slate-100 px-6 text-center">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">RepLog could not start</h1>
          <p className="mt-2 text-sm text-slate-600">The API URL is not configured correctly. Please contact the site administrator.</p>
        </div>
      </main>
    )
  }

  if (state === 'checking') {
    return (
      <main className="relative min-h-dvh bg-slate-100 px-4">
        <BrandedLoader fullScreen statusMessage={announcement} />
        {showColdStartHint ? (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 mt-8 flex justify-center px-4">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 animate-spin text-slate-500 motion-reduce:animate-none"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="2"
                />
                <path
                  d="M14 8a6 6 0 0 0-6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
              <span>Starting RepLog…</span>
            </p>
          </div>
        ) : null}
      </main>
    )
  }

  if (state === 'failed') {
    return (
      <main className="grid min-h-dvh place-content-center bg-slate-100 px-6 text-center">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">RepLog is starting slowly</h1>
          <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
          <p className="mt-2 text-sm text-slate-600">{isOnline ? 'RepLog will retry while this page is open and online.' : 'You’re offline. Reconnect to continue startup.'}</p>
          <button
            type="button"
            disabled={!isOnline}
            className="mt-5 min-h-11 min-w-11 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setAnnouncement('Retrying RepLog')
              setState('checking')
              setRetryCount((count) => count + 1)
            }}
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  return children
}
