import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi, beforeAll } from 'vitest'
import { ProgressPage } from '../pages/ProgressPage'
import {
  getProgress,
  type ProgressData,
  type ProgressExerciseSummary,
} from '../lib/progress'
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

function createSession(id: string, daysAgo: number, v: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return {
    sessionId: id,
    startedAt: d.toISOString(),
    workoutDate: d.toISOString(),
    dayName: 'Day',
    volumeKg: v * 10,
    topSet: { estimatedOneRepMaxKg: v, weightKg: v, reps: 1 }
  }
}

function createSummary(id: string, name: string, category: string, sessions: { daysAgo: number, v: number }[]): ProgressExerciseSummary {
  return {
    exercise: { id, name, category },
    personalBest: null,
    stats: { sessionCount: sessions.length, progressKg: 0, heaviestWeightKg: 0 },
    sessionHistory: sessions.map((s, i) => createSession(`${id}-s${i}`, s.daysAgo, s.v)),
    trendEstimatedOneRepMaxKg: []
  }
}

function progressData(overrides: Partial<ProgressData> = {}): ProgressData {
  return {
    exercises: [],
    selectedExercise: null,
    personalBest: null,
    stats: { sessionCount: 0, progressKg: 0, heaviestWeightKg: 0 },
    sessionHistory: [],
    trendEstimatedOneRepMaxKg: [],
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

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

beforeEach(() => {
  mockedGetProgress.mockReset()
  mockedGetDashboard.mockResolvedValue(dashboardData)
})

describe('ProgressPage - Compare Chart & Sparklines', () => {
  it('handles loading, initial error, refresh error, and empty states', async () => {
    let resolveProgress!: (data: ProgressData) => void
    mockedGetProgress.mockReturnValue(new Promise((resolve) => {
      resolveProgress = resolve
    }))

    renderProgress()
    expect(await screen.findByRole('status', { name: 'Loading progress...' })).toBeInTheDocument()

    await act(async () => resolveProgress(progressData()))
    expect(await screen.findByRole('heading', { name: 'No finished sets yet.' })).toBeInTheDocument()

    mockedGetProgress.mockRejectedValue(new Error('offline'))
    renderProgress()
    expect(await screen.findByText('Unable to load progress. Please refresh and try again.')).toBeInTheDocument()
  })

  it('renders Compare chart with up to 3 defaults, legend chips, and sparklines', async () => {
    const data = progressData({
      exerciseSummaries: [
        createSummary('ex1', 'Bench', 'Chest', [{ daysAgo: 10, v: 100 }, { daysAgo: 5, v: 110 }, { daysAgo: 1, v: 120 }]),
        createSummary('ex2', 'Squat', 'Legs', [{ daysAgo: 10, v: 100 }, { daysAgo: 5, v: 100 }]),
        createSummary('ex3', 'Row', 'Back', [{ daysAgo: 10, v: 100 }, { daysAgo: 1, v: 80 }]),
        createSummary('ex4', 'Curl', 'Arms', [{ daysAgo: 10, v: 50 }, { daysAgo: 1, v: 55 }]),
      ]
    })
    mockedGetProgress.mockResolvedValue(data)

    renderProgress()

    // Default top 3 are selected (based on n -> ex1, ex2, ex3)
    expect(await screen.findByRole('heading', { name: /Compare/ })).toBeInTheDocument()
    expect(screen.getByText('3 of 5')).toBeInTheDocument()

    // Legend chips
    expect(screen.getByRole('button', { name: 'Remove Bench from chart' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Curl from chart' })).not.toBeInTheDocument()

    // Chart is rendered
    expect(screen.getByRole('img', { name: /Line chart of percent change/ })).toBeInTheDocument()
  })

  it('toggles time range, metric, and view', async () => {
    const data = progressData({
      exerciseSummaries: [
        createSummary('ex1', 'Bench', 'Chest', [{ daysAgo: 10, v: 100 }, { daysAgo: 1, v: 120 }]),
      ]
    })
    mockedGetProgress.mockResolvedValue(data)

    renderProgress()

    expect(await screen.findByRole('button', { name: '30d' })).toBeInTheDocument()

    // Metric
    fireEvent.click(screen.getByRole('button', { name: 'Volume' }))
    // Volume was 10x
    expect(screen.getByText('1,200 kg')).toBeInTheDocument()

    // View Table
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Line chart/ })).not.toBeInTheDocument()
  })

  it('toggles exercises in/out of Compare and shows limit hint', async () => {
    const summaries = Array.from({ length: 6 }).map((_, i) =>
      createSummary(`ex${i}`, `Ex ${i}`, 'All', [{ daysAgo: 10, v: 100 }, { daysAgo: 1, v: 110 }])
    )
    const data = progressData({ exerciseSummaries: summaries })
    mockedGetProgress.mockResolvedValue(data)

    renderProgress()

    await screen.findByText('3 of 5')

    // Click 4th and 5th sparkline row to add
    const pickButtons = screen.getAllByRole('button', { name: /Compare Ex/ })
    fireEvent.click(pickButtons[3]) // add 4th
    fireEvent.click(pickButtons[4]) // add 5th

    expect(screen.getByText('5 of 5')).toBeInTheDocument()

    // Try 6th
    fireEvent.click(pickButtons[5])
    expect(screen.getByText('The chart holds up to 5. Remove one to add another.')).toBeInTheDocument()

    // Remove one via legend pill
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ex 0 from chart' }))
    expect(screen.getByText('4 of 5')).toBeInTheDocument()
    expect(screen.queryByText('The chart holds up to 5.')).not.toBeInTheDocument()
  })

  it('filters and sorts sparkline rows', async () => {
    const data = progressData({
      exerciseSummaries: [
        createSummary('ex1', 'Zebra', 'Legs', [{ daysAgo: 10, v: 100 }, { daysAgo: 1, v: 150 }]), // Gain +50%
        createSummary('ex2', 'Apple', 'Chest', [{ daysAgo: 10, v: 100 }, { daysAgo: 5, v: 100 }, { daysAgo: 1, v: 100 }]), // Stalled
      ]
    })
    mockedGetProgress.mockResolvedValue(data)

    renderProgress()

    // Sort A to Z
    const sortSelect = await screen.findByRole('combobox', { name: 'Sort exercises' })
    fireEvent.change(sortSelect, { target: { value: 'az' } })
    const rowsAZ = screen.getAllByRole('button', { name: /Compare/ })
    expect(rowsAZ[0]).toHaveAttribute('aria-label', 'Compare Apple')

    // Search
    fireEvent.change(screen.getByPlaceholderText('Search exercises'), { target: { value: 'Zeb' } })
    expect(screen.getAllByText('Zebra').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Compare Apple' })).not.toBeInTheDocument()

    // Muscle Group filter
    fireEvent.change(screen.getByPlaceholderText('Search exercises'), { target: { value: '' } }) // clear
    fireEvent.click(screen.getByRole('button', { name: 'Chest' }))
    expect(screen.getAllByText('Apple').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Compare Zebra' })).not.toBeInTheDocument()
  })

  it('opens and interacts with the 1RM explainer sheet (Dialog)', async () => {
    const data = progressData({
      exerciseSummaries: [
        createSummary('ex1', 'Bench', 'Chest', [{ daysAgo: 10, v: 100 }, { daysAgo: 1, v: 120 }]),
      ]
    })
    mockedGetProgress.mockResolvedValue(data)
    renderProgress()

    const explainerBtn = await screen.findByRole('button', { name: /How 1RM works/ })
    fireEvent.click(explainerBtn)

    // Wait for dialog
    const dialog = screen.getByRole('dialog', { name: 'Estimated 1RM' })
    expect(dialog).toBeInTheDocument()

    // Calculate logic check: epley 100x5 = 116.7
    expect(within(dialog).getByText('116.7 kg')).toBeInTheDocument()

    // Raise reps to 6 => 100 * (1 + 6/30) = 120
    fireEvent.click(within(dialog).getByRole('button', { name: 'More reps' }))
    expect(within(dialog).getByText('120 kg')).toBeInTheDocument()

    // Close via Got It
    fireEvent.click(within(dialog).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
