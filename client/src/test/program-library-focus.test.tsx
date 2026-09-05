import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProgramLibraryPage } from '../pages/ProgramLibraryPage'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/programs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/programs')>()

  return {
    ...actual,
    getPrograms: vi.fn().mockResolvedValue([
      { id: 'active', name: 'Active', isActive: true, dayCount: 1, exerciseCount: 1 },
      { id: 'other', name: 'Other', isActive: false, dayCount: 1, exerciseCount: 1 },
    ]),
    getProgramTemplates: vi.fn().mockResolvedValue([]),
    activateProgram: vi.fn(() => new Promise(() => undefined)),
  }
})

vi.mock('../lib/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dashboard')>()

  return {
    ...actual,
    getDashboard: vi.fn().mockResolvedValue({ activeSession: null }),
  }
})

describe('program library navigation focus', () => {
  it('focuses the Programs heading after editor deletion navigation', async () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{ pathname: '/program', state: { focus: 'programs-heading' } }]}>
          <ProgramLibraryPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const heading = screen.getByRole('heading', { name: 'Programs' })

    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('locks conflicting library controls during activation', async () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/program']}>
          <ProgramLibraryPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const activateButton = await screen.findByRole('button', { name: 'Make active' })
    fireEvent.click(activateButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ New Program' })).toBeDisabled()
      expect(screen.getByRole('button', { name: '+ Create another program' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Switching...' })).toBeDisabled()
      expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'true')
    })
  })
})
