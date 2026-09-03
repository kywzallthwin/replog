import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDashboard, type DashboardData } from '../lib/dashboard'
import { authMeQueryKey } from '../lib/auth'
import { ProfilePage } from '../pages/ProfilePage'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dashboard')>()

  return {
    ...actual,
    getDashboard: vi.fn(),
  }
})

const mockedGetDashboard = vi.mocked(getDashboard)

describe('profile page loading', () => {
  beforeEach(() => {
    mockedGetDashboard.mockReset()
  })

  it('keeps the shell and loader visible until profile statistics resolve', async () => {
    let resolveDashboard!: (dashboard: DashboardData) => void
    mockedGetDashboard.mockReturnValue(
      new Promise<DashboardData>((resolve) => {
        resolveDashboard = resolve
      }),
    )
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    })
    queryClient.setQueryData(authMeQueryKey, {
      id: 'user-1',
      email: 'lifter@example.com',
      username: 'Lifter',
      avatarInitial: 'L',
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(await screen.findByRole('status', { name: 'Loading profile...' })).toBeInTheDocument()
    expect(screen.queryByText('0kg')).not.toBeInTheDocument()

    await act(async () => {
      resolveDashboard({
        activeSession: null,
        activeProgram: null,
        suggestedDay: null,
        recentSessions: [],
        stats: { workoutCount: 12, setCount: 34, totalVolumeKg: 567 },
      })
    })

    expect(await screen.findByText('Lifter')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('34')).toBeInTheDocument()
    expect(screen.getByText('567kg')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading profile...' })).not.toBeInTheDocument()
  })
})
