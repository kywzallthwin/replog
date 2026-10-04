import { api } from './api'

export type CategorySummary = { id: string; name: string; isCustom: boolean; isOverridden?: boolean }

export type ExerciseOption = {
  id: string
  name: string
  category: CategorySummary
  isCustom?: boolean
}

type ExercisesResponse = {
  exercises: ExerciseOption[]
}
type CategoriesResponse = { categories: CategorySummary[] }

export const exercisesQueryKey = ['exercises'] as const
export const categoriesQueryKey = ['exercise-categories'] as const

export async function getExercises() {
  const response = await api.get<ExercisesResponse>('/exercises')

  return response.data.exercises
}

export async function getCategories() {
  const response = await api.get<CategoriesResponse>('/exercises/categories')
  return response.data.categories
}

export async function createCategory(name: string) {
  const response = await api.post<{ category: CategorySummary }>('/exercises/categories', { name })
  return response.data.category
}

export async function renameCategory(categoryId: string, name: string) {
  const response = await api.patch<{ category: CategorySummary }>(`/exercises/categories/${categoryId}`, { name })
  return response.data.category
}

export async function resetCategoryLabel(categoryId: string) {
  await api.delete(`/exercises/categories/${categoryId}/label`)
}

export async function deleteCategory(categoryId: string, replacementCategoryId?: string) {
  await api.delete(`/exercises/categories/${categoryId}`, { params: replacementCategoryId ? { replacementCategoryId } : undefined })
}

export async function recategorizeExercise(exerciseId: string, categoryId: string) {
  const response = await api.patch<ExerciseResponse>(`/exercises/${exerciseId}/category`, { categoryId })
  return response.data.exercise
}

export type MergeExerciseResult = {
  changedProgramDayEntries: number
  changedWorkoutEntries: number
}

export async function mergeExercise(sourceId: string, targetExerciseId: string) {
  const response = await api.post<MergeExerciseResult>(`/exercises/${sourceId}/merge`, { targetExerciseId })
  return response.data
}

export type CreateExerciseInput = {
  name: string
  categoryId: string
}

type ExerciseResponse = {
  exercise: ExerciseOption
}

export async function createExercise(input: CreateExerciseInput) {
  const response = await api.post<ExerciseResponse>('/exercises', input)

  return response.data.exercise
}
