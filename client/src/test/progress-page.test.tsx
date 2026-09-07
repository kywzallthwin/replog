import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressPage } from '../pages/ProgressPage'
import { getProgress, progressQueryKey, type ProgressData } from '../lib/progress'
import { getDashboard, type DashboardData } from '../lib/dashboard'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/progress')>()
  return { ...actual, getProgress: vi.fn() }
})

vi.mock('../lib/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dashboard')>()
  return { ...actual, getDashboard: vi.fn() }
})

const mockedGetProgress = vi.mocked(getProgress)
const mockedGetDashboard = vi.mocked(getDashboard)

const dashboardData: DashboardData = {
  activeSession: null,
  activeProgram: null,
  suggestedDay: null,
  recentSessions: [],
  stats: { workoutCount: 0, setCount: 0, totalVolumeKg: 0 },
}

function progressData(overrides: Partial<ProgressData> = {}): ProgressData {
  return {
    exercises: [{ id: 'bench', name: 'Bench Press', category: 'CHEST' }],
    selectedExercise: { id: 'bench', name: 'Bench Press', category: 'CHEST' },
    personalBest: {
      sessionId: 'session-best',
      startedAt: '2026-09-06T08:00:00.000Z',
      estimatedOneRepMaxKg: 101.2,
      weightKg: 90,
      reps: 5,
    },
    stats: { sessionCount: 3, progressKg: 7.5, heaviestWeightKg: 90 },
    sessionHistory: [
      {
        sessionId: 'session-1',
        startedAt: '2026-09-06T08:00:00.000Z',
        dayName: 'Upper A',
        topSet: { estimatedOneRepMaxKg: 101.2, weightKg: 90, reps: 5 },
      },
    ],
    trendEstimatedOneRepMaxKg: [93.7, 98.4, 101.2],
    ...overrides,
  }
}

function renderProgress(initialEntries = ['/progress']) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ProgressPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return queryClient
}

beforeEach(() => {
  mockedGetProgress.mockReset()
  mockedGetDashboard.mockResolvedValue(dashboardData)
})

describe('ProgressPage states and values', () => {
  it('keeps loading separate from empty and populated states', async () => {
    let resolveProgress!: (data: ProgressData) => void
    mockedGetProgress.mockReturnValue(new Promise((resolve) => {
      resolveProgress = resolve
    }))

    renderProgress()

    expect(await screen.findByRole('status', { name: 'Loading progress...' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select exercise: Loading exercise data' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'No finished sets yet.' })).not.toBeInTheDocument()
    expect(screen.queryByText('Sessions')).not.toBeInTheDocument()

    await act(async () => resolveProgress(progressData({ selectedExercise: null, exercises: [] })))
    expect(await screen.findByRole('heading', { name: 'No finished sets yet.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select exercise: No exercise data' })).toBeDisabled()
  })

  it('announces an initial error with an unavailable selector state', async () => {
    mockedGetProgress.mockRejectedValue(new Error('offline'))

    renderProgress()

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load progress.')
    expect(screen.getByRole('button', { name: 'Select exercise: Exercise data unavailable' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'No finished sets yet.' })).not.toBeInTheDocument()
  })

  it('preserves populated values and links', async () => {
    mockedGetProgress.mockResolvedValue(progressData())

    renderProgress()

    expect((await screen.findAllByText('101.2 kg')).length).toBeGreaterThan(0)
    expect(screen.getByText('+7.5 kg')).toBeInTheDocument()
    expect(screen.getByText('90 kg')).toBeInTheDocument()
    expect(screen.getByText('93.7 -> 98.4 -> 101.2 kg')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /From 90 kg x 5 reps/ })).toHaveAttribute(
      'href',
      '/workout/session-best?from=progress',
    )
    expect(screen.getByRole('link', { name: 'Sep 6' })).toHaveAttribute(
      'href',
      '/workout/session-1?from=progress',
    )
  })

  it('keeps cached values visible when a refresh fails', async () => {
    const cachedProgress = progressData()
    mockedGetProgress.mockRejectedValueOnce(new Error('offline'))
    const queryClient = renderProgress()
    queryClient.setQueryData(progressQueryKey(null), cachedProgress)

    await waitFor(() => expect(screen.getAllByText('101.2 kg').length).toBeGreaterThan(0))
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: progressQueryKey(null) })
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to refresh progress')
    expect(screen.getAllByText('101.2 kg').length).toBeGreaterThan(0)
  })

  it('wraps long names and uses a responsive summary grid', async () => {
    const longExerciseName = 'E'.repeat(80)
    mockedGetProgress.mockResolvedValue(progressData({
      exercises: [{ id: 'long-exercise', name: longExerciseName, category: 'CHEST' }],
      selectedExercise: { id: 'long-exercise', name: longExerciseName, category: 'CHEST' },
      stats: { sessionCount: 1000, progressKg: 1000, heaviestWeightKg: 1000 },
    }))

    renderProgress()

    expect((await screen.findAllByText(longExerciseName)).length).toBeGreaterThan(0)
    const main = screen.getByRole('main')
    const selectedName = screen.getAllByText(longExerciseName).find((element) => element.className.includes('text-xs'))
    const statsGrid = screen.getByText('Heaviest Set').closest('div[class*="grid-cols-2"]')
    const heaviestCard = screen.getByText('Heaviest Set').parentElement

    if (!selectedName || !statsGrid || !heaviestCard) throw new Error('Progress summary layout was not rendered')
    expect(main).toHaveClass('w-full', 'min-w-0', 'overflow-x-hidden')
    expect(selectedName).toHaveClass('min-w-0', 'break-words')
    expect(selectedName?.className).toContain('[overflow-wrap:anywhere]')
    expect(statsGrid).toHaveClass('grid-cols-2', 'sm:grid-cols-3')
    expect(heaviestCard).toHaveClass('col-span-2', 'sm:col-span-1')
    expect(screen.getByText('+1000 kg')).toBeInTheDocument()
    expect(screen.getByText('1000 kg')).toBeInTheDocument()
  })
})
