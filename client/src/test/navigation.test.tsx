import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'
import { dashboardQueryKey, type DashboardData } from '../lib/dashboard'
import { createTestQueryClient } from './query-client'

function dashboardData(activeProgramId: string | null): DashboardData {
  return {
    activeSession: null,
    activeProgram: activeProgramId
      ? { id: activeProgramId, name: 'Active Program', days: [] }
      : null,
    suggestedDay: null,
    recentSessions: [],
    stats: { workoutCount: 0, setCount: 0, totalVolumeKg: 0 },
  }
}

function renderNavigation(activeProgramId: string | null, route = '/dashboard') {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  queryClient.setQueryData(dashboardQueryKey, dashboardData(activeProgramId))

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <TopNav />
        <BottomTabBar />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('primary navigation', () => {
  it('opens the active program from both Program navigation links', () => {
    renderNavigation('program-1', '/program/program-1')

    const programLinks = screen.getAllByRole('link', { name: 'Program' })
    expect(programLinks).toHaveLength(2)
    for (const link of programLinks) {
      expect(link).toHaveAttribute('href', '/program/program-1')
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('falls back to the program library and stays active throughout program routes', () => {
    renderNavigation(null, '/program')

    for (const link of screen.getAllByRole('link', { name: 'Program' })) {
      expect(link).toHaveAttribute('href', '/program')
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })
})
