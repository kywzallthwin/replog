import type { ReactElement } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, it, vi } from 'vitest'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'
import { EditProfilePage } from '../pages/EditProfilePage'
import { authMeQueryKey, changePassword, getCurrentUser, updateCurrentUser } from '../lib/auth'
import { failForKnownBaselineDefect } from './expected-failure'
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

  it.fails('associates edit-profile labels with their inputs', () => {
    return failForKnownBaselineDefect(() => {
      const { container } = renderWithProfile(<EditProfilePage />)
      const contracts = getFieldContracts(container, ['Username', 'Email'])

      return contracts?.every((contract, index) => (
        contract.associated && contract.autocomplete === ['username', 'email'][index]
      ))
    }, 'edit-profile labels are not associated with their inputs and autocomplete values')
  })

  it.fails('associates change-password labels with suitable autocomplete fields', () => {
    return failForKnownBaselineDefect(() => {
      const { container } = renderWithProfile(<ChangePasswordPage />)
      const contracts = getFieldContracts(container, ['Current Password', 'New Password', 'Confirm New Password'])

      return contracts?.every((contract, index) => (
        contract.associated && contract.autocomplete === ['current-password', 'new-password', 'new-password'][index]
      ))
    }, 'change-password labels are not associated with their inputs and autocomplete values')
  })
})
