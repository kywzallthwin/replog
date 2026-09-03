import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../pages/DashboardPage'
import { authMeQueryKey } from '../lib/auth'
import { dashboardQueryKey, getDashboard, type DashboardData } from '../lib/dashboard'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dashboard')>()

  return {
    ...actual,
    getDashboard: vi.fn(),
  }
})

const mockedGetDashboard = vi.mocked(getDashboard)

function dashboardData(activeProgram: DashboardData['activeProgram']): DashboardData {
  return {
    activeSession: null,
    activeProgram,
    suggestedDay: null,
    recentSessions: [],
    stats: { workoutCount: 0, setCount: 0, totalVolumeKg: 0 },
  }
}

function renderDashboard(data: DashboardData, staleTime = Infinity) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime, retry: false } },
  })
  queryClient.setQueryData(authMeQueryKey, {
    id: 'user-1',
    email: 'lifter@example.com',
    username: 'Lifter',
    avatarInitial: 'L',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  queryClient.setQueryData(dashboardQueryKey, data)

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('dashboard Up Next fallbacks', () => {
  beforeEach(() => {
    mockedGetDashboard.mockReset()
    mockedGetDashboard.mockReturnValue(new Promise<DashboardData>(() => undefined))
  })

  it('offers program editing when the active program has no usable day', () => {
    renderDashboard(
      dashboardData({
        id: 'program-1',
        name: 'Active Program',
        days: [{ id: 'empty-day', name: 'REST', badgeColor: 'neutral', exerciseCount: 0, categories: [] }],
      }),
    )

    expect(screen.getByText(/Up Next/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Active Program' })).toHaveAttribute(
      'href',
      '/program/program-1',
    )
    expect(screen.getByRole('link', { name: 'Edit Program' })).toHaveAttribute(
      'href',
      '/program/program-1',
    )
    expect(screen.queryByRole('button', { name: 'Start Workout' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'REST' })).not.toBeInTheDocument()
    expect(screen.queryByText('Or pick a day:')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Browse Programs' })).not.toBeInTheDocument()
    expect(screen.queryByText(/suggested routine/i)).not.toBeInTheDocument()
  })

  it('falls back to the program library when there is no active program', () => {
    renderDashboard(dashboardData(null))

    expect(screen.getByText('Up Next')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse Programs' })).toHaveAttribute('href', '/program')
    expect(screen.queryByRole('link', { name: 'Edit Program' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start Workout' })).not.toBeInTheDocument()
  })

  it('keeps populated content during a background dashboard refresh', () => {
    renderDashboard(
      {
        ...dashboardData({
          id: 'program-1',
          name: 'Active Program',
          days: [],
        }),
        stats: { workoutCount: 7, setCount: 21, totalVolumeKg: 350 },
      },
      0,
    )

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading dashboard...' })).not.toBeInTheDocument()
  })
})
