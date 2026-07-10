import { api } from './api'

export type ProgressExercise = {
  id: string
  name: string
  category: string
}

export type ProgressPersonalBest = {
  sessionId: string
  startedAt: string
  estimatedOneRepMaxKg: number
  weightKg: number
  reps: number
}

export type ProgressSessionHistory = {
  sessionId: string
  startedAt: string
  dayName: string
  topSet: {
    estimatedOneRepMaxKg: number
    weightKg: number
    reps: number
  }
}

export type ProgressData = {
  exercises: ProgressExercise[]
  selectedExercise: ProgressExercise | null
  personalBest: ProgressPersonalBest | null
  stats: {
    sessionCount: number
    progressKg: number
    heaviestWeightKg: number
  }
  sessionHistory: ProgressSessionHistory[]
  trendEstimatedOneRepMaxKg: number[]
}

export function progressQueryKey(exerciseId: string | null) {
  return ['progress', exerciseId ?? ''] as const
}

export async function getProgress(exerciseId: string | null) {
  const response = await api.get<ProgressData>('/progress', {
    params: exerciseId ? { exerciseId } : undefined,
  })

  return response.data
}
