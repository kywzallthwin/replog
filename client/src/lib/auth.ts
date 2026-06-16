import { api } from './api'

export type AuthUser = {
  id: string
  email: string
  username: string
  avatarInitial: string
  createdAt: string
}

type AuthMeResponse = {
  user: AuthUser
}

export const authMeQueryKey = ['auth', 'me'] as const

export async function getCurrentUser() {
  const response = await api.get<AuthMeResponse>('/auth/me')

  return response.data.user
}

export async function logoutUser() {
  await api.post('/auth/logout')
}
