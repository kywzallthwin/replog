import { api } from './api'

export type ProgressExercise = {
  id: string
  name: string
  category: string
}

export type ProgressPersonalBest = {
  sessionId: string
  startedAt: string
  workoutDate?: string | null
  estimatedOneRepMaxKg: number
  weightKg: number
  reps: number
}

export type ProgressSessionHistory = {
  sessionId: string
  startedAt: string
  workoutDate?: string | null
  dayName: string
  volumeKg?: number
  topSet: {
    estimatedOneRepMaxKg: number
    weightKg: number
    reps: number
  }
}

export type ProgressStats = {
  sessionCount: number
  progressKg: number
  heaviestWeightKg: number
}

export type ProgressExerciseSummary = {
  exercise: ProgressExercise
  personalBest: ProgressPersonalBest | null
  stats: ProgressStats
  sessionHistory: ProgressSessionHistory[]
  trendEstimatedOneRepMaxKg: number[]
}

export type ProgressData = {
  exercises: ProgressExercise[]
  selectedExercise: ProgressExercise | null
  personalBest: ProgressPersonalBest | null
  stats: ProgressStats
  sessionHistory: ProgressSessionHistory[]
  trendEstimatedOneRepMaxKg: number[]
  exerciseSummaries?: ProgressExerciseSummary[]
}

export function progressQueryKey(exerciseId: string | null) {
  return ['progress', exerciseId ?? ''] as const
}

export function normalizeProgressData(data: ProgressData): ProgressData {
  const normalizeSessionHistory = (history: ProgressSessionHistory[]) =>
    history.map((session) => ({
      ...session,
      volumeKg: session.volumeKg ?? session.topSet.weightKg * session.topSet.reps,
    }))

  const baseData = {
    ...data,
    sessionHistory: normalizeSessionHistory(data.sessionHistory),
  }

  if (data.exerciseSummaries?.length) {
    return {
      ...baseData,
      exerciseSummaries: data.exerciseSummaries.map((summary) => ({
        ...summary,
        sessionHistory: normalizeSessionHistory(summary.sessionHistory),
      })),
    }
  }

  if (!data.selectedExercise) {
    return { ...baseData, exerciseSummaries: [] }
  }

  return {
    ...baseData,
    exerciseSummaries: [
      {
        exercise: data.selectedExercise,
        personalBest: data.personalBest,
        stats: data.stats,
        sessionHistory: baseData.sessionHistory,
        trendEstimatedOneRepMaxKg: data.trendEstimatedOneRepMaxKg,
      },
    ],
  }
}

export async function getProgress(exerciseId: string | null) {
  const response = await api.get<ProgressData>('/progress', {
    params: exerciseId ? { exerciseId } : undefined,
  })

  return normalizeProgressData(response.data)
}
