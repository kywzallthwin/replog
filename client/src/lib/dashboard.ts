import { api } from './api'

export type DashboardDay = {
  id: string
  name: string
  badgeColor: string
  order?: number
  exerciseCount: number
  categories: string[]
}

export type DashboardSession = {
  id: string
  dayName: string
  badgeColor: string
  startedAt: string
  endedAt: string | null
  durationSec: number | null
  exerciseCount: number
}

export type DashboardData = {
  activeSession: DashboardSession | null
  activeProgram: {
    id: string
    name: string
    days: DashboardDay[]
  } | null
  suggestedDay: DashboardDay | null
  recentSessions: DashboardSession[]
  stats: {
    workoutCount: number
    setCount: number
    totalVolumeKg: number
  }
}

export const dashboardQueryKey = ['dashboard'] as const

export async function getDashboard() {
  const response = await api.get<DashboardData>('/dashboard')

  return response.data
}
