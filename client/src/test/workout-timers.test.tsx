import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatWorkoutDuration, useWorkoutTimer } from '../lib/useWorkoutTimer'
import { useRestTimer } from '../lib/useRestTimer'

const now = new Date('2026-09-06T12:00:00.000Z')
const sessionKey = (sessionId: string) => `replog:rest-timer:${sessionId}`

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.useRealTimers()
})

describe('workout timer', () => {
  it('formats durations below and above an hour', () => {
    expect(formatWorkoutDuration(0)).toBe('0:00')
    expect(formatWorkoutDuration(65)).toBe('1:05')
    expect(formatWorkoutDuration(3_599)).toBe('59:59')
    expect(formatWorkoutDuration(3_600)).toBe('1:00:00')
    expect(formatWorkoutDuration(7_261)).toBe('2:01:01')
  })

  it('returns zero for an invalid start timestamp', () => {
    const { result } = renderHook(() => useWorkoutTimer('not-a-timestamp'))

    expect(result.current).toBe(0)

    act(() => vi.advanceTimersByTime(2_000))

    expect(result.current).toBe(0)
  })

  it('calculates elapsed time and updates on intervals and visibility changes', () => {
    const startedAt = new Date(now.getTime() - 65_000).toISOString()
    const { result } = renderHook(() => useWorkoutTimer(startedAt))

    expect(result.current).toBe(65)

    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current).toBe(66)

    act(() => {
      vi.setSystemTime(now.getTime() + 10_400)
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current).toBe(75)
  })
})

describe('rest timer', () => {
  it('is initially hidden without a persisted timer', () => {
    const { result } = renderHook(() => useRestTimer('session-1', 'active'))

    expect(result.current.remainingSeconds).toBeNull()
    expect(result.current.formatted).toBeNull()
  })

  it('starts at 90 seconds, persists an absolute expiry, and counts down', () => {
    const { result } = renderHook(() => useRestTimer('session-1', 'active'))

    act(() => result.current.start())

    expect(result.current.remainingSeconds).toBe(90)
    expect(result.current.formatted).toBe('1:30')
    expect(window.localStorage.getItem(sessionKey('session-1'))).toBe(
      String(now.getTime() + 90_000),
    )

    act(() => vi.advanceTimersByTime(1_000))

    expect(result.current.remainingSeconds).toBe(89)
    expect(result.current.formatted).toBe('1:29')
  })

  it('restores a persisted countdown after remounting', () => {
    const first = renderHook(() => useRestTimer('session-1', 'active'))

    act(() => first.result.current.start())
    first.unmount()
    vi.setSystemTime(now.getTime() + 30_000)

    const second = renderHook(() => useRestTimer('session-1', 'active'))

    expect(second.result.current.remainingSeconds).toBe(60)
    expect(second.result.current.formatted).toBe('1:00')
  })

  it('extends an active timer by 15 seconds from its existing expiry', () => {
    const { result } = renderHook(() => useRestTimer('session-1', 'active'))

    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(10_000))
    act(() => result.current.addSeconds(15))

    expect(result.current.remainingSeconds).toBe(95)
    expect(window.localStorage.getItem(sessionKey('session-1'))).toBe(
      String(now.getTime() + 105_000),
    )
  })

  it('holds an expired timer at zero and adds new time from now', () => {
    const { result } = renderHook(() => useRestTimer('session-1', 'active'))

    act(() => result.current.start(1))
    act(() => vi.advanceTimersByTime(5_000))

    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.formatted).toBe('0:00')
    expect(window.localStorage.getItem(sessionKey('session-1'))).toBe(
      String(now.getTime() + 1_000),
    )

    act(() => result.current.addSeconds(15))

    expect(result.current.remainingSeconds).toBe(15)
    expect(window.localStorage.getItem(sessionKey('session-1'))).toBe(
      String(now.getTime() + 20_000),
    )
  })

  it('stays at zero until skipped, then removes the stored timer', () => {
    const { result } = renderHook(() => useRestTimer('session-1', 'active'))

    act(() => result.current.start(1))
    act(() => vi.advanceTimersByTime(2_000))

    expect(result.current.remainingSeconds).toBe(0)
    expect(window.localStorage.getItem(sessionKey('session-1'))).not.toBeNull()

    act(() => result.current.skip())

    expect(result.current.remainingSeconds).toBeNull()
    expect(result.current.formatted).toBeNull()
    expect(window.localStorage.getItem(sessionKey('session-1'))).toBeNull()
  })

  it('clear hides the timer and removes its persisted expiry', () => {
    const { result } = renderHook(() => useRestTimer('session-1', 'active'))

    act(() => result.current.start())
    act(() => result.current.clear())

    expect(result.current.remainingSeconds).toBeNull()
    expect(window.localStorage.getItem(sessionKey('session-1'))).toBeNull()
  })

  it('cleans up persisted timer state for a completed session', () => {
    window.localStorage.setItem(sessionKey('session-1'), String(now.getTime() + 90_000))

    const { result } = renderHook(() => useRestTimer('session-1', 'completed'))

    expect(result.current.remainingSeconds).toBeNull()
    expect(result.current.formatted).toBeNull()
    expect(window.localStorage.getItem(sessionKey('session-1'))).toBeNull()
  })

  it('keeps persisted timers isolated when the session changes', () => {
    window.localStorage.setItem(sessionKey('session-1'), String(now.getTime() + 30_000))
    window.localStorage.setItem(sessionKey('session-2'), String(now.getTime() + 60_000))

    const { result, rerender } = renderHook(
      ({ sessionId }) => useRestTimer(sessionId, 'active'),
      { initialProps: { sessionId: 'session-1' } },
    )

    expect(result.current.remainingSeconds).toBe(30)

    rerender({ sessionId: 'session-2' })
    expect(result.current.remainingSeconds).toBe(60)

    act(() => result.current.skip())

    expect(window.localStorage.getItem(sessionKey('session-1'))).toBe(
      String(now.getTime() + 30_000),
    )
    expect(window.localStorage.getItem(sessionKey('session-2'))).toBeNull()
  })

  it('recalculates from absolute time on visibility changes', () => {
    const { result } = renderHook(() => useRestTimer('session-1', 'active'))

    act(() => result.current.start())
    act(() => {
      vi.setSystemTime(now.getTime() + 35_000)
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.remainingSeconds).toBe(55)
    expect(result.current.formatted).toBe('0:55')
  })
})
