import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser } from '../lib/auth'
import { RequireAuth } from '../components/auth/RequireAuth'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/auth', () => ({
  authMeQueryKey: ['auth', 'me'],
  getCurrentUser: vi.fn(),
}))

const mockedGetCurrentUser = vi.mocked(getCurrentUser)

function LocationProbe() {
  const location = useLocation()

  return <output data-testid="location">{location.pathname}</output>
}

function renderBoundary() {
  const queryClient = createTestQueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route
            path="/private"
            element={
              <RequireAuth>
                <p>Private workout</p>
              </RequireAuth>
            }
          />
          <Route
            path="/login"
            element={
              <>
                <h1>Login</h1>
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('authentication navigation boundary', () => {
  beforeEach(() => {
    mockedGetCurrentUser.mockReset()
  })

  it('redirects unauthenticated visitors to login without calling a live service', async () => {
    mockedGetCurrentUser.mockRejectedValue(new Error('not authenticated'))

    renderBoundary()

    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
    expect(screen.queryByText('Private workout')).not.toBeInTheDocument()
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('renders protected content after the mocked user check succeeds', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'lifter@example.com',
      username: 'Lifter',
      avatarInitial: 'L',
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    renderBoundary()

    expect(await screen.findByText('Private workout')).toBeInTheDocument()
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1)
  })
})
