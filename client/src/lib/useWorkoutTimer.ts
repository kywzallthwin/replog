import { useEffect, useState } from 'react'

function getElapsedSeconds(startedAt: string) {
  const startedAtMs = Date.parse(startedAt)

  if (!Number.isFinite(startedAtMs)) {
    return 0
  }

  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
}

export function formatWorkoutDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => value.toString().padStart(2, '0')

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
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
