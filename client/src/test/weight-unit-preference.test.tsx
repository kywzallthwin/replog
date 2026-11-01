import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authMeQueryKey, getCurrentUser, updateCurrentUser, type AuthUser } from '../lib/auth'
import { dashboardQueryKey, getDashboard, type DashboardData } from '../lib/dashboard'
import { getProgress, type ProgressData } from '../lib/progress'
import {
  addSet,
  addSetChain,
  getSession,
  getSessionHistory,
  updateSet,
  type WorkoutHistorySession,
  type WorkoutSession,
  type WorkoutSet,
} from '../lib/sessions'
import { LB_PER_KG } from '../lib/units'
import { DashboardPage } from '../pages/DashboardPage'
import { HistoryPage } from '../pages/HistoryPage'
import { ProfilePage } from '../pages/ProfilePage'
import { ProgressPage } from '../pages/ProgressPage'
import { WorkoutPage } from '../pages/WorkoutPage'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth')>()
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    updateCurrentUser: vi.fn(),
  }
})

vi.mock('../lib/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dashboard')>()
  return {
    ...actual,
    getDashboard: vi.fn(),
  }
})

vi.mock('../lib/progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/progress')>()
  return {
    ...actual,
    getProgress: vi.fn(),
  }
})

vi.mock('../lib/sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sessions')>()
  return {
    ...actual,
    getSession: vi.fn(),
    getSessionHistory: vi.fn(),
    addSet: vi.fn(),
    addSetChain: vi.fn(),
    updateSet: vi.fn(),
  }
})

const mockedGetCurrentUser = vi.mocked(getCurrentUser)
const mockedUpdateCurrentUser = vi.mocked(updateCurrentUser)
const mockedGetDashboard = vi.mocked(getDashboard)
const mockedGetProgress = vi.mocked(getProgress)
const mockedGetSession = vi.mocked(getSession)
const mockedGetSessionHistory = vi.mocked(getSessionHistory)
const mockedAddSet = vi.mocked(addSet)
const mockedAddSetChain = vi.mocked(addSetChain)
const mockedUpdateSet = vi.mocked(updateSet)

function makeUser(weightUnit: 'KG' | 'LB' = 'KG'): AuthUser {
  return {
    id: 'user-1',
    email: 'lifter@example.com',
    username: 'Lifter',
    avatarInitial: 'L',
    weightUnit,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const sampleDashboard: DashboardData = {
  activeSession: null,
  activeProgram: null,
  suggestedDay: null,
  recentSessions: [],
  stats: {
    workoutCount: 12,
    setCount: 34,
    totalVolumeKg: 567,
  },
}

const sampleProgress: ProgressData = {
  exercises: [{ id: 'bench', name: 'Bench Press', category: 'CHEST' }],
  selectedExercise: { id: 'bench', name: 'Bench Press', category: 'CHEST' },
  personalBest: {
    sessionId: 'session-best',
    startedAt: '2026-09-06T08:00:00.000Z',
    estimatedOneRepMaxKg: 101.2,
    weightKg: 90,
    reps: 5,
  },
  stats: {
    sessionCount: 3,
    progressKg: 7.5,
    heaviestWeightKg: 90,
  },
  sessionHistory: [
    {
      sessionId: 'session-1',
      startedAt: '2026-09-06T08:00:00.000Z',
      dayName: 'Upper A',
      topSet: { estimatedOneRepMaxKg: 101.2, weightKg: 90, reps: 5 },
    },
  ],
  trendEstimatedOneRepMaxKg: [93.7, 98.4, 101.2],
}

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: 'set-1',
    kind: 'NORMAL',
    parentSetId: null,
    notes: null,
    weightKg: 100,
    reps: 8,
    order: 0,
    ...overrides,
  }
}

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    programId: 'program-1',
    programName: 'Strength Base',
    dayId: 'day-1',
    dayName: 'Upper A',
    badgeColor: 'blue',
    startedAt: '2026-09-06T08:00:00.000Z',
    endedAt: null,
    durationSec: null,
    exercises: [
      {
        id: 'session-exercise-1',
        exerciseId: 'bench',
        name: 'Bench Press',
        order: 0,
        sets: [makeSet()],
        lastTime: {
          sessionId: 'previous-session',
          performedAt: '2026-09-02T12:00:00.000Z',
          weightKg: 100,
          reps: 8,
        },
        previousWorkout: {
          sessionId: 'previous-session',
          performedAt: '2026-09-02T12:00:00.000Z',
          bestNormalSetId: 'prev-normal',
          sets: [
            makeSet({ id: 'prev-warmup', kind: 'WARMUP', weightKg: 40, reps: 10, order: 0 }),
            makeSet({ id: 'prev-normal', weightKg: 77.5, reps: 8, order: 1 }),
            makeSet({ id: 'prev-drop', kind: 'DROP', parentSetId: 'prev-normal', weightKg: 60, reps: 6, order: 2 }),
          ],
        },
      },
    ],
    ...overrides,
  }
}

describe('Cross-page kg/lb preference and conversion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetCurrentUser.mockResolvedValue(makeUser('KG'))
    mockedUpdateCurrentUser.mockImplementation(async (input) =>
      makeUser(input.weightUnit ?? 'KG'),
    )
    mockedGetDashboard.mockResolvedValue(sampleDashboard)
    mockedGetProgress.mockResolvedValue(sampleProgress)
    mockedGetSession.mockResolvedValue(makeSession())
    mockedGetSessionHistory.mockResolvedValue([])
  })

  it('toggles kg/lb on ProfilePage with accessible 44px controls and updates lifted volume', async () => {
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    })
    queryClient.setQueryData(authMeQueryKey, makeUser('KG'))
    queryClient.setQueryData(dashboardQueryKey, sampleDashboard)

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const unitsGroup = await screen.findByRole('group', { name: 'Units' })
    const kgButton = within(unitsGroup).getByRole('button', { name: 'kg' })
    const lbButton = within(unitsGroup).getByRole('button', { name: 'lb' })

    expect(kgButton).toHaveClass('min-h-11', 'min-w-11')
    expect(lbButton).toHaveClass('min-h-11', 'min-w-11')
    expect(kgButton).toHaveAttribute('aria-pressed', 'true')
    expect(lbButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('567kg')).toBeInTheDocument()

    // Clicking active unit does not trigger mutation
    fireEvent.click(kgButton)
    expect(mockedUpdateCurrentUser).not.toHaveBeenCalled()

    // Switch to lb
    fireEvent.click(lbButton)

    await waitFor(() => {
      expect(mockedUpdateCurrentUser).toHaveBeenCalledWith({ weightUnit: 'LB' })
    })
    expect(lbButton).toHaveAttribute('aria-pressed', 'true')
    expect(kgButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('1250lb')).toBeInTheDocument()
  })

  it('updates DashboardPage volume value and unit label when preference is LB', async () => {
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    })
    queryClient.setQueryData(authMeQueryKey, makeUser('LB'))
    queryClient.setQueryData(dashboardQueryKey, {
      ...sampleDashboard,
      stats: { workoutCount: 5, setCount: 15, totalVolumeKg: 350 },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('772')).toBeInTheDocument()
    expect(screen.getByText('Lb Lifted')).toBeInTheDocument()
  })

  it('converts ProgressPage PB, progress delta, heaviest set, session history, and trend to LB', async () => {
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    })
    queryClient.setQueryData(authMeQueryKey, makeUser('LB'))

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/progress']}>
          <ProgressPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect((await screen.findAllByText('223.1 lb')).length).toBeGreaterThan(0)
    expect(screen.getByText('+16.5 lb')).toBeInTheDocument()
    expect(screen.getByText('198.4 lb')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /From 198.4 lb x 5 reps/ })).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: /206.6 lb to 216.9 lb to 223.1 lb; up/ }),
    ).toBeInTheDocument()
    const chartFigure = screen.getByRole('figure', { name: 'Estimated 1RM chart for Bench Press' })
    expect(within(chartFigure).getByText('Estimated 1RM (lb)')).toBeInTheDocument()
    expect(within(chartFigure).getByText('206.6 lb – 223.1 lb')).toBeInTheDocument()
    expect(
      within(chartFigure).getByRole('img', {
        name: /starts at 206.6 lb, latest 223.1 lb, range 206.6 lb to 223.1 lb, trend increasing \(\+16.5 lb\)/,
      }),
    ).toBeInTheDocument()
  })

  it('converts WorkoutPage displays, converts pound inputs to kg once on submit, and avoids edit round-trip drift', async () => {
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } },
    })
    queryClient.setQueryData(authMeQueryKey, makeUser('LB'))

    mockedAddSet.mockImplementation(async (input) =>
      makeSet({
        id: 'created-single',
        kind: input.kind,
        notes: input.notes ?? null,
        weightKg: input.weightKg,
        reps: input.reps,
        order: 1,
      }),
    )
    mockedAddSetChain.mockImplementation(async (input) =>
      input.sets.map((set, index) =>
        makeSet({
          id: `created-${index}`,
          kind: set.kind,
          weightKg: set.weightKg,
          reps: set.reps,
          order: index + 1,
        }),
      ),
    )
    mockedUpdateSet.mockImplementation(async (input) =>
      makeSet({
        id: input.setId,
        kind: input.kind,
        notes: input.notes ?? null,
        weightKg: input.weightKg,
        reps: input.reps,
      }),
    )

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workout/session-1']}>
          <Routes>
            <Route path="/workout/:sessionId" element={<WorkoutPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const card = (await screen.findByRole('heading', { name: 'Bench Press' })).closest('article')!

    // Logged set (100 kg) and previous workout sets (40 kg, 77.5 kg -> 60 kg) display in lb
    expect(within(card).getByText('220.5 lb')).toBeInTheDocument()
    const previousLine = within(card).getByLabelText(/Previous workout sets/)
    expect(previousLine).toHaveTextContent('wu88.2×10')
    expect(previousLine).toHaveTextContent('170.9×8→132.3×6')

    // Delete set dialog displays lb
    fireEvent.click(within(card).getByRole('button', { name: 'Delete set' }))
    const deleteDialog = screen.getByRole('alertdialog', { name: 'Delete 220.5 lb x 8?' })
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Cancel' }))

    // Edit set without changing weight ("220.5") preserves exact canonical 100 kg (zero round-trip drift)
    fireEvent.click(within(card).getByRole('button', { name: 'Edit set' }))
    const editForm = within(card).getByText('Edit Set').closest('form')!
    const editWeightInput = within(editForm).getByRole('spinbutton', { name: 'Weight lb' })
    expect(editWeightInput).toHaveValue(220.5)
    fireEvent.change(within(editForm).getByRole('spinbutton', { name: 'Reps' }), { target: { value: '10' } })
    fireEvent.submit(editForm)

    await waitFor(() => {
      expect(mockedUpdateSet).toHaveBeenCalledTimes(1)
    })
    expect(mockedUpdateSet.mock.calls[0]?.[0].weightKg).toBe(100)
    expect(mockedUpdateSet.mock.calls[0]?.[0].reps).toBe(10)

    // Add set with pound entry (135 lb + drop 90 lb) converts lb -> kg once at API boundary
    fireEvent.click(within(card).getByRole('button', { name: 'Add Set' }))
    const addForm = within(card).getByText('New Set').closest('form')!
    const addWeightInput = within(addForm).getByRole('spinbutton', { name: 'Weight lb' })
    expect(addWeightInput).toHaveValue(220.5)

    fireEvent.change(addWeightInput, { target: { value: '135' } })
    fireEvent.change(within(addForm).getByRole('spinbutton', { name: 'Reps' }), { target: { value: '8' } })
    fireEvent.click(within(addForm).getByRole('button', { name: /Add drop set/ }))

    const dropWeightInput = within(addForm).getByRole('spinbutton', { name: 'Drop 1 weight lb' })
    const dropRepsInput = within(addForm).getByRole('spinbutton', { name: 'Drop 1 reps' })
    fireEvent.change(dropWeightInput, { target: { value: '90' } })
    fireEvent.change(dropRepsInput, { target: { value: '6' } })
    fireEvent.submit(addForm)

    await waitFor(() => {
      expect(mockedAddSetChain).toHaveBeenCalledTimes(1)
    })
    const submittedSets = mockedAddSetChain.mock.calls[0]?.[0].sets ?? []
    expect(submittedSets[0]?.weightKg).toBeCloseTo(135 / LB_PER_KG, 10)
    expect(submittedSets[1]?.weightKg).toBeCloseTo(90 / LB_PER_KG, 10)

    // Input remains formatted in lb ("135") after save, not raw kg
    await waitFor(() => {
      expect(within(addForm).getByRole('spinbutton', { name: 'Weight lb' })).toHaveValue(135)
    })

    // Saving another single set without changing the pre-filled "135" weight preserves exact canonical kg
    fireEvent.change(within(addForm).getByRole('spinbutton', { name: 'Reps' }), { target: { value: '9' } })
    fireEvent.submit(addForm)

    await waitFor(() => {
      expect(mockedAddSet).toHaveBeenCalledTimes(1)
    })
    expect(mockedAddSet.mock.calls[0]?.[0].weightKg).toBe(submittedSets[0]?.weightKg)
    expect(mockedAddSet.mock.calls[0]?.[0].reps).toBe(9)
  })

  it('formats completed workout summary volume and HistoryPage volume in LB', async () => {
    const completedSession = makeSession({
      endedAt: '2026-09-06T09:00:00.000Z',
      durationSec: 3600,
      exercises: [
        {
          id: 'session-exercise-1',
          exerciseId: 'bench',
          name: 'Bench Press',
          order: 0,
          sets: [makeSet({ weightKg: 100, reps: 10 })],
          lastTime: null,
          previousWorkout: null,
        },
      ],
    })
    const historySessions: WorkoutHistorySession[] = [
      {
        id: 'session-1',
        programName: 'Strength Base',
        dayName: 'Upper A',
        badgeColor: 'blue',
        startedAt: '2026-09-06T08:00:00.000Z',
        endedAt: '2026-09-06T09:00:00.000Z',
        durationSec: 3600,
        exerciseCount: 1,
        setCount: 1,
        totalVolumeKg: 1000,
      },
    ]
    mockedGetSession.mockResolvedValue(completedSession)
    mockedGetSessionHistory.mockResolvedValue(historySessions)

    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    })
    queryClient.setQueryData(authMeQueryKey, makeUser('LB'))

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/history']}>
          <HistoryPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText(/2,204.6 lb/)).toBeInTheDocument()
    unmount()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workout/session-1?from=history']}>
          <Routes>
            <Route path="/workout/:sessionId" element={<WorkoutPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('2,204.6 lb')).toBeInTheDocument()
    expect(screen.getByText('220.5 lb')).toBeInTheDocument()
  })
})
