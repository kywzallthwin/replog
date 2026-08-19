import { useEffect, useState } from 'react'

function getElapsedSeconds(startedAt: string) {
  const startedAtMs = Date.parse(startedAt)

  if (!Number.isFinite(startedAtMs)) {
    return 0
  }

  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
}

export function useWorkoutTimer(startedAt: string) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getElapsedSeconds(startedAt))

  useEffect(() => {
    const updateElapsedTime = () => {
      setElapsedSeconds(getElapsedSeconds(startedAt))
    }

    updateElapsedTime()
    const intervalId = window.setInterval(updateElapsedTime, 1000)
    document.addEventListener('visibilitychange', updateElapsedTime)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', updateElapsedTime)
    }
  }, [startedAt])

  return elapsedSeconds
}
