import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiStartupGate } from '../components/startup/ApiStartupGate'
import { GuestOnly } from '../components/auth/GuestOnly'
import { RequireAuth } from '../components/auth/RequireAuth'
import { getCurrentUser } from '../lib/auth'
import { waitForApiReadiness } from '../lib/apiReadiness'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/apiReadiness', () => ({ waitForApiReadiness: vi.fn() }))
vi.mock('../lib/auth', async () => {
  const actual = await vi.importActual<typeof import('../lib/auth')>('../lib/auth')
  return { ...actual, getCurrentUser: vi.fn() }
})

const mockedReadiness = vi.mocked(waitForApiReadiness)
const mockedGetCurrentUser = vi.mocked(getCurrentUser)

const user = {
  id: 'user-1',
  email: 'lifter@example.com',
  username: 'Lifter',
  avatarInitial: 'L',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function renderProtected() {
  const queryClient = createTestQueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <ApiStartupGate>
          <Routes>
            <Route path="/dashboard" element={<RequireAuth><p>Protected dashboard</p></RequireAuth>} />
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </ApiStartupGate>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderGuest() {
  const queryClient = createTestQueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <ApiStartupGate>
          <Routes>
            <Route path="/login" element={<GuestOnly><p>Login page</p></GuestOnly>} />
            <Route path="/dashboard" element={<p>Dashboard page</p>} />
          </Routes>
        </ApiStartupGate>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('startup and authentication flow', () => {
  beforeEach(() => {
    mockedReadiness.mockReset()
    mockedGetCurrentUser.mockReset()
  })

  it('does not call authentication while readiness is pending', () => {
    mockedReadiness.mockReturnValue(new Promise<void>(() => undefined))
    renderProtected()

    expect(screen.getByRole('status')).toHaveTextContent('Starting RepLog...')
    expect(mockedGetCurrentUser).not.toHaveBeenCalled()
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument()
  })

  it('opens the protected route only after readiness succeeds', async () => {
    const events: string[] = []
    let resolveReadiness: () => void = () => undefined
    mockedReadiness.mockImplementation(() => {
      events.push('readiness:start')
      return new Promise<void>((resolve) => {
        resolveReadiness = () => {
          events.push('readiness:success')
          resolve()
        }
      })
    })
    mockedGetCurrentUser.mockImplementation(async () => {
      events.push('auth:start')
      return user
    })
    renderProtected()

    resolveReadiness()
    expect(await screen.findByText('Protected dashboard')).toBeInTheDocument()
    expect(events).toEqual(['readiness:start', 'readiness:success', 'auth:start'])
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('does not mount authentication when readiness fails', async () => {
    mockedReadiness.mockRejectedValue(new Error('cold start failed'))
    renderProtected()

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(mockedGetCurrentUser).not.toHaveBeenCalled()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('runs authentication after a successful manual readiness retry', async () => {
    mockedReadiness.mockRejectedValueOnce(new Error('cold start')).mockResolvedValueOnce(undefined)
    mockedGetCurrentUser.mockResolvedValue(user)
    renderProtected()

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Protected dashboard')).toBeInTheDocument()
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('preserves the protected unauthenticated redirect after readiness', async () => {
    mockedReadiness.mockResolvedValue(undefined)
    mockedGetCurrentUser.mockRejectedValue(new Error('not authenticated'))
    renderProtected()

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument()
  })

  it('preserves guest behavior after readiness', async () => {
    mockedReadiness.mockResolvedValue(undefined)
    mockedGetCurrentUser.mockRejectedValue(new Error('not authenticated'))
    renderGuest()

    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  it('redirects authenticated guests after readiness', async () => {
    mockedReadiness.mockResolvedValue(undefined)
    mockedGetCurrentUser.mockResolvedValue(user)
    renderGuest()

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('aborts the stale readiness run under Strict Mode', async () => {
    const signals: AbortSignal[] = []
    mockedReadiness.mockImplementation(({ signal }) => {
      signals.push(signal!)
      return new Promise<void>(() => undefined)
    })

    render(<StrictMode><ApiStartupGate><p>Application</p></ApiStartupGate></StrictMode>)

    await waitFor(() => expect(signals.length).toBe(2))
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
    expect(mockedGetCurrentUser).not.toHaveBeenCalled()
  })
})
