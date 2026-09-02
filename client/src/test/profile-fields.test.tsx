import type { ReactElement } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'
import { EditProfilePage } from '../pages/EditProfilePage'
import { authMeQueryKey, changePassword, getCurrentUser, updateCurrentUser } from '../lib/auth'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/auth', () => ({
  authMeQueryKey: ['auth', 'me'],
  changePassword: vi.fn(),
  getCurrentUser: vi.fn(),
  updateCurrentUser: vi.fn(),
}))

const profileUser = {
  id: 'user-1',
  email: 'lifter@example.com',
  username: 'Lifter',
  avatarInitial: 'L',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function renderWithProfile(ui: ReactElement) {
  const queryClient = createTestQueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })
  queryClient.setQueryData(authMeQueryKey, profileUser)

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function getFieldContracts(container: HTMLElement, expectedLabels: readonly string[]) {
  const labels = [...container.querySelectorAll<HTMLLabelElement>('label')]
  const inputs = [...container.querySelectorAll<HTMLInputElement>('input')]

  if (labels.length !== expectedLabels.length || inputs.length !== expectedLabels.length) {
    return
  }

  const contracts = labels.map((label, index) => ({
    label: label.textContent?.trim(),
    associated: label.control === inputs[index],
    autocomplete: inputs[index]?.getAttribute('autocomplete') ?? null,
  }))

  if (contracts.some((contract, index) => contract.label !== expectedLabels[index])) {
    return
  }

  return contracts
}

describe('profile form fields', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(profileUser)
    vi.mocked(updateCurrentUser).mockResolvedValue(profileUser)
    vi.mocked(changePassword).mockResolvedValue(undefined)
  })

  it('associates edit-profile labels with their inputs and autocomplete values', () => {
    const { container } = renderWithProfile(<EditProfilePage />)

    expect(getFieldContracts(container, ['Username', 'Email'])).toEqual([
      { label: 'Username', associated: true, autocomplete: 'username' },
      { label: 'Email', associated: true, autocomplete: 'email' },
    ])
  })

  it('associates change-password labels with suitable autocomplete fields', () => {
    const { container } = renderWithProfile(<ChangePasswordPage />)

    expect(getFieldContracts(container, ['Current Password', 'New Password', 'Confirm New Password'])).toEqual([
      { label: 'Current Password', associated: true, autocomplete: 'current-password' },
      { label: 'New Password', associated: true, autocomplete: 'new-password' },
      { label: 'Confirm New Password', associated: true, autocomplete: 'new-password' },
    ])
  })

  it('announces password feedback and keeps visibility controls tappable', async () => {
    const { container } = renderWithProfile(<ChangePasswordPage />)

    for (const name of ['Show current password', 'Show new password', 'Show confirm password']) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-11', 'min-w-11')
    }

    const currentPassword = screen.getByLabelText('Current Password')
    const newPassword = screen.getByLabelText('New Password')
    const confirmPassword = screen.getByLabelText('Confirm New Password')
    const form = container.querySelector('form')

    if (!form) {
      throw new Error('Change-password form was not rendered')
    }

    fireEvent.change(currentPassword, { target: { value: 'current-password' } })
    fireEvent.change(newPassword, { target: { value: 'new-password' } })
    fireEvent.change(confirmPassword, { target: { value: 'different-password' } })
    fireEvent.submit(form)

    expect(screen.getByRole('alert')).toHaveTextContent('New passwords do not match')

    fireEvent.change(confirmPassword, { target: { value: 'new-password' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Password updated.')
    })
  })
})
