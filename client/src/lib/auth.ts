import { api } from './api'

export type AuthUser = {
  id: string
  email: string
  username: string
  avatarInitial: string
  createdAt: string
}

export type AuthResponse = {
  user: AuthUser
}

export type UpdateCurrentUserInput = {
  email: string
  username: string
}

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

export const authMeQueryKey = ['auth', 'me'] as const

export async function getCurrentUser() {
  const response = await api.get<AuthResponse>('/auth/me')

  return response.data.user
}

export async function logoutUser() {
  await api.post('/auth/logout')
}

export async function updateCurrentUser(input: UpdateCurrentUserInput) {
  const response = await api.patch<AuthResponse>('/users/me', input)

  return response.data.user
}

export async function changePassword(input: ChangePasswordInput) {
  await api.post('/users/me/password', input)
}
