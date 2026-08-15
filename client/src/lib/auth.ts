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

export type ForgotPasswordInput = {
  email: string
}

export type ResetPasswordInput = {
  token: string
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

export async function requestPasswordReset(input: ForgotPasswordInput) {
  await api.post('/auth/forgot-password', input)
}

export async function resetPassword(input: ResetPasswordInput) {
  await api.post('/auth/reset-password', input)
}
