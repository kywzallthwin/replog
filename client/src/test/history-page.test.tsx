import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryPage } from '../pages/HistoryPage'
import { getSessionHistory, type WorkoutHistorySession } from '../lib/sessions'
import { getDashboard, type DashboardData } from '../lib/dashboard'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sessions')>()
  return { ...actual, getSessionHistory: vi.fn() }
})

vi.mock('../lib/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dashboard')>()
  return { ...actual, getDashboard: vi.fn() }
})

const mockedGetSessionHistory = vi.mocked(getSessionHistory)
const mockedGetDashboard = vi.mocked(getDashboard)

const dashboardData: DashboardData = {
  activeSession: null,
  activeProgram: null,
  suggestedDay: null,
  recentSessions: [],
  stats: { workoutCount: 0, setCount: 0, totalVolumeKg: 0 },
}

function historySession(overrides: Partial<WorkoutHistorySession> = {}): WorkoutHistorySession {
  return {
    id: 'session-1',
    programName: 'Strength Base',
    dayName: 'Upper A',
    badgeColor: 'bg-blue-100 text-blue-800',
    startedAt: '2026-09-06T08:00:00.000Z',
    endedAt: '2026-09-06T09:00:00.000Z',
    durationSec: 3600,
    exerciseCount: 5,
    setCount: 15,
    ...overrides,
  }
}

function renderHistory() {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/history']}>
        <HistoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedGetSessionHistory.mockReset()
  mockedGetDashboard.mockResolvedValue(dashboardData)
})

describe('HistoryPage states and values', () => {
  it('keeps loading separate from empty and populated states', async () => {
    let resolveHistory!: (sessions: WorkoutHistorySession[]) => void
    mockedGetSessionHistory.mockReturnValue(new Promise((resolve) => {
      resolveHistory = resolve
    }))

    renderHistory()

    expect(await screen.findByRole('status', { name: 'Loading history...' })).toBeInTheDocument()
    expect(screen.queryByText('No finished workouts yet')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Upper A/ })).not.toBeInTheDocument()

    await act(async () => resolveHistory([]))
    expect(await screen.findByRole('heading', { name: 'No finished workouts yet' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading history...' })).not.toBeInTheDocument()
  })

  it('announces an initial history error without showing an empty state', async () => {
    mockedGetSessionHistory.mockRejectedValue(new Error('offline'))

    renderHistory()

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load workout history.')
    expect(screen.queryByRole('heading', { name: 'No finished workouts yet' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading history...' })).not.toBeInTheDocument()
  })

  it('preserves populated history values, grouping, and navigation', async () => {
    mockedGetSessionHistory.mockResolvedValue([
      historySession({ id: 'september-session', startedAt: '2026-09-06T08:00:00.000Z' }),
      historySession({
        id: 'august-session',
        dayName: 'Lower B',
        programName: null,
        startedAt: '2026-08-22T08:00:00.000Z',
        durationSec: null,
        exerciseCount: 3,
        setCount: 8,
      }),
    ])

    renderHistory()

    expect(await screen.findByRole('heading', { name: 'September 2026' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument()
    expect(screen.getByText('Upper A')).toBeInTheDocument()
    expect(screen.getByText(/5 exercises · 15 sets · 60 min/)).toBeInTheDocument()
    expect(screen.getByText(/3 exercises · 8 sets · Duration unavailable/)).toBeInTheDocument()

    const septemberCard = screen.getByRole('link', { name: /Upper A/ })
    expect(septemberCard).toHaveAttribute('href', '/workout/september-session?from=history')
    expect(screen.getByRole('link', { name: /Lower B/ })).toHaveAttribute('href', '/workout/august-session?from=history')
    expect(screen.getAllByRole('link', { name: 'History' }).some((link) => link.getAttribute('aria-current') === 'page')).toBe(true)
  })

  it('keeps cached history visible when a refresh fails', async () => {
    const cachedSessions = [historySession()]
    mockedGetSessionHistory.mockRejectedValueOnce(new Error('offline'))

    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    queryClient.setQueryData(['sessions', 'history'], cachedSessions)

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/history']}>
          <HistoryPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('link', { name: /Upper A/ })).toBeInTheDocument()
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['sessions', 'history'] })
    })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to refresh workout history'))
    expect(screen.getByRole('link', { name: /Upper A/ })).toBeInTheDocument()
  })

  it('contains unbroken history names and keeps the chevron decorative', async () => {
    const longDayName = 'D'.repeat(60)
    const longProgramName = 'P'.repeat(80)
    mockedGetSessionHistory.mockResolvedValue([historySession({ dayName: longDayName, programName: longProgramName })])

    renderHistory()

    const card = await screen.findByRole('link', { name: new RegExp(longDayName) })
    const main = screen.getByRole('main')
    const badge = screen.getByText(longDayName)
    const metadata = screen.getByText(new RegExp(longProgramName))
    const date = screen.getByText('Sun, Sep 6')

    expect(main).toHaveClass('w-full', 'min-w-0', 'overflow-x-hidden')
    expect(main.querySelector('.max-w-5xl')).toHaveClass('w-full', 'min-w-0')
    expect(card).toHaveClass('min-w-0')
    expect(badge).toHaveClass('min-w-0', 'max-w-full', 'break-words')
    expect(badge.className).toContain('[overflow-wrap:anywhere]')
    expect(metadata).toHaveClass('min-w-0', 'break-words')
    expect(date).toHaveClass('min-w-0', 'break-words')
    expect(card.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(metadata).toHaveTextContent(longProgramName)
  })
})
