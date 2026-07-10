import { api } from './api'

export type ExerciseCategory = 'CHEST' | 'BACK' | 'SHOULDERS' | 'LEGS' | 'ARMS' | 'CORE'

export type ExerciseOption = {
  id: string
  name: string
  category: ExerciseCategory
}

type ExercisesResponse = {
  exercises: ExerciseOption[]
}

export const exercisesQueryKey = ['exercises'] as const

export async function getExercises() {
  const response = await api.get<ExercisesResponse>('/exercises')

  return response.data.exercises
}
