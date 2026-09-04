import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProgramLibraryPage } from '../pages/ProgramLibraryPage'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/programs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/programs')>()

  return {
    ...actual,
    getPrograms: vi.fn().mockResolvedValue([]),
    getProgramTemplates: vi.fn().mockResolvedValue([]),
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
})
