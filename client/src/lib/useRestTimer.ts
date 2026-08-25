import { useEffect, useState } from 'react'

const defaultRestSeconds = 90

export type RestTimerSessionStatus = 'loading' | 'active' | 'completed'

function getStorageKey(sessionId: string) {
  return `replog:rest-timer:${sessionId}`
}

function readEndAt(sessionId: string | undefined) {
  if (!sessionId || typeof window === 'undefined') {
    return null
  }

  const stored = window.localStorage.getItem(getStorageKey(sessionId))

  if (!stored) {
    return null
  }

  const endAt = Number(stored)
  return Number.isFinite(endAt) ? endAt : null
}

function removeStoredEndAt(sessionId: string | undefined) {
  if (!sessionId || typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(getStorageKey(sessionId))
}

function formatRestDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function useRestTimer(sessionId: string | undefined, sessionStatus: RestTimerSessionStatus) {
  const [timerState, setTimerState] = useState<{ sessionId: string | undefined; endAt: number | null }>(() => ({
    sessionId,
    endAt: readEndAt(sessionId),
  }))
  const [now, setNow] = useState(() => Date.now())

  const endAt = sessionStatus === 'completed'
    ? null
    : timerState.sessionId === sessionId
      ? timerState.endAt
      : readEndAt(sessionId)

  useEffect(() => {
    if (sessionStatus === 'completed') {
      removeStoredEndAt(sessionId)
      return
    }

    if (sessionStatus !== 'active' || endAt === null) {
      return
    }

    const updateNow = () => setNow(Date.now())
    updateNow()
    const interval = window.setInterval(updateNow, 1000)
    document.addEventListener('visibilitychange', updateNow)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', updateNow)
    }
  }, [endAt, sessionId, sessionStatus])

  const remainingSeconds = endAt === null ? null : Math.max(0, Math.ceil((endAt - now) / 1000))

  function persist(nextEndAt: number | null) {
    if (!sessionId) {
      return
    }

    if (nextEndAt === null) {
      removeStoredEndAt(sessionId)
    } else {
      window.localStorage.setItem(getStorageKey(sessionId), nextEndAt.toString())
    }

    setTimerState({ sessionId, endAt: nextEndAt })
    setNow(Date.now())
  }

  function start(seconds = defaultRestSeconds) {
    persist(Date.now() + seconds * 1000)
  }

  function addSeconds(seconds: number) {
    const base = endAt !== null && endAt > Date.now() ? endAt : Date.now()
    persist(base + seconds * 1000)
  }

  function skip() {
    persist(null)
  }

  return {
    remainingSeconds,
    formatted: remainingSeconds === null ? null : formatRestDuration(remainingSeconds),
    start,
    addSeconds,
    skip,
    clear: skip,
  }
}
