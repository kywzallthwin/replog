import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  const [totalElapsedSeconds, setTotalElapsedSeconds] = useState(0)
  const [attemptElapsedSeconds, setAttemptElapsedSeconds] = useState(0)
  const [attemptInProgress, setAttemptInProgress] = useState(false)
  const [announcement, setAnnouncement] = useState(() => navigator.onLine ? 'Starting RepLog' : 'Offline. Reconnect to continue startup.')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const startedAtRef = useRef<number | null>(null)
  const attemptStartedAtRef = useRef<number | null>(null)

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
    const startedAt = startedAtRef.current ?? Date.now()
    startedAtRef.current = startedAt
    const elapsedTimer = setInterval(() => {
      const currentTime = Date.now()
      setTotalElapsedSeconds(Math.floor((currentTime - startedAt) / 1000))
      if (attemptStartedAtRef.current !== null) {
        setAttemptElapsedSeconds(Math.floor((currentTime - attemptStartedAtRef.current) / 1000))
      }
    }, 1000)
    const finishAttempt = () => {
      if (attemptStartedAtRef.current !== null) {
        setAttemptElapsedSeconds(Math.floor((Date.now() - attemptStartedAtRef.current) / 1000))
      }
      attemptStartedAtRef.current = null
      setAttemptInProgress(false)
    }
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
      attemptStartedAtRef.current = Date.now()
      setAttemptElapsedSeconds(0)
      setAttemptInProgress(true)
      const controller = new AbortController()
      currentController = controller
      void ensureApiAvailable(() => apiBaseUrl, controller.signal).then(
        () => {
          if (active) {
            startupComplete = true
            finishAttempt()
            stopStartupWatchers()
            setState('ready')
          }
        },
        () => {
          if (!active || controller.signal.aborted) return
          finishAttempt()
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
      finishAttempt()
      retryAfterCancellation = false
      if (retryTimer) clearTimeout(retryTimer)
      currentController?.abort()
    }
    stopStartupWatchers = () => {
      if (retryTimer) clearTimeout(retryTimer)
      clearInterval(elapsedTimer)
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
      <main className="min-h-dvh bg-slate-100 px-4">
        <div className="grid min-h-dvh content-center justify-items-center gap-4 text-center">
          <BrandedLoader fullScreen={false} statusMessage={announcement} />
          <div className="w-full max-w-xs">
            <p className="text-sm font-semibold text-slate-800">Starting RepLog…</p>
            <p className="mt-1 text-sm text-slate-600">Waking the service and checking its database</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Current readiness attempt" aria-valuemin={0} aria-valuemax={90} aria-valuenow={Math.min(90, attemptElapsedSeconds)}><div className="h-full rounded-full bg-slate-800 transition-[width] duration-300" style={{ width: `${Math.min(100, attemptElapsedSeconds / 90 * 100)}%` }} /></div>
            <p className="mt-2 text-xs text-slate-600">Current attempt: {attemptElapsedSeconds}s / 90s</p>
            <p className="mt-1 text-xs text-slate-500">Total waiting: {totalElapsedSeconds}s</p>
          </div>
        </div>
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
          <p className="mt-2 text-xs text-slate-500">Total waiting: {totalElapsedSeconds}s</p>
          {isOnline && attemptInProgress ? <>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Current readiness attempt" aria-valuemin={0} aria-valuemax={90} aria-valuenow={Math.min(90, attemptElapsedSeconds)}><div className="h-full rounded-full bg-slate-800 transition-[width] duration-300" style={{ width: `${Math.min(100, attemptElapsedSeconds / 90 * 100)}%` }} /></div>
            <p className="mt-2 text-xs text-slate-600">Current attempt: {attemptElapsedSeconds}s / 90s</p>
          </> : <p className="mt-2 text-xs text-slate-600">Current attempt: {isOnline ? 'waiting for automatic retry' : 'paused while offline'}</p>}
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
