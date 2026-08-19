import { api } from './api'

export type ExerciseCategory = 'CHEST' | 'BACK' | 'SHOULDERS' | 'LEGS' | 'ARMS' | 'CORE'

export type ExerciseOption = {
  id: string
  name: string
  category: ExerciseCategory
  isCustom?: boolean
}

type ExercisesResponse = {
  exercises: ExerciseOption[]
}

export const exercisesQueryKey = ['exercises'] as const

export async function getExercises() {
  const response = await api.get<ExercisesResponse>('/exercises')

  return response.data.exercises
}

export type CreateExerciseInput = {
  name: string
  category: ExerciseCategory
}

type ExerciseResponse = {
  exercise: ExerciseOption
}

export async function createExercise(input: CreateExerciseInput) {
  const response = await api.post<ExerciseResponse>('/exercises', input)

  return response.data.exercise
}
