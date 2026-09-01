import type { ReactElement } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RegisterPage } from '../pages/RegisterPage'
import { api } from '../lib/api'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/api', () => ({
  apiBaseUrl: 'http://test.invalid/api',
  api: {
    post: vi.fn(),
  },
}))

function renderWithProviders(ui: ReactElement) {
  const queryClient = createTestQueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('authentication forms', () => {
  it('focuses the first invalid registration field and describes the error', () => {
    const { container } = renderWithProviders(<RegisterPage />)
    const form = container.querySelector('form')

    if (!form) {
      throw new Error('Registration form was not rendered')
    }

    fireEvent.submit(form)

    const usernameInput = screen.getByRole('textbox', { name: 'Username' })

    expect(usernameInput).toHaveFocus()
    expect(usernameInput).toHaveAccessibleDescription('Username is required.')
    expect(api.post).not.toHaveBeenCalled()
  })
})
