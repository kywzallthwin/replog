import { api } from './api'
import type { ExerciseCategory } from './exercises'

export const DAY_BADGE_COLORS = [
  'bg-amber-100 text-amber-800',
  'bg-blue-100 text-blue-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
] as const

export type DayBadgeColor = (typeof DAY_BADGE_COLORS)[number]

export type DayExerciseItem = {
  id: string
  exerciseId: string
  name: string
  category: ExerciseCategory
  order: number
}

export type ProgramDay = {
  id: string
  name: string
  badgeColor: string
  order: number
  exercises: DayExerciseItem[]
}

export type Program = {
  id: string
  name: string
  isActive: boolean
  days: ProgramDay[]
}

type ProgramResponse = {
  program: Program | null
}

type DayResponse = {
  day: ProgramDay
}

type DayExerciseResponse = {
  exercise: DayExerciseItem
}

type DayExercisesResponse = {
  exercises: DayExerciseItem[]
}

export type AddDayInput = {
  name: string
  badgeColor: DayBadgeColor
}

export type UpdateDayInput = {
  dayId: string
  name?: string
  badgeColor?: DayBadgeColor
}

export type DeleteDayInput = {
  dayId: string
}

export type AddDayExerciseInput = {
  dayId: string
  exerciseId: string
}

export type RemoveDayExerciseInput = {
  dayId: string
  dayExerciseId: string
}

export type ReorderDayExerciseInput = {
  dayId: string
  dayExerciseId: string
  targetIndex: number
}

export const programQueryKey = ['programs', 'active'] as const

export async function getActiveProgram() {
  const response = await api.get<ProgramResponse>('/programs/active')

  return response.data.program
}

export async function addDay(input: AddDayInput) {
  const response = await api.post<DayResponse>('/programs/active/days', {
    name: input.name,
    badgeColor: input.badgeColor,
  })

  return response.data.day
}

export async function updateDay(input: UpdateDayInput) {
  const response = await api.patch<DayResponse>(`/programs/days/${input.dayId}`, {
    name: input.name,
    badgeColor: input.badgeColor,
  })

  return response.data.day
}

export async function deleteDay(input: DeleteDayInput) {
  await api.delete(`/programs/days/${input.dayId}`)
}

export async function addDayExercise(input: AddDayExerciseInput) {
  const response = await api.post<DayExerciseResponse>(`/programs/days/${input.dayId}/exercises`, {
    exerciseId: input.exerciseId,
  })

  return response.data.exercise
}

export async function removeDayExercise(input: RemoveDayExerciseInput) {
  await api.delete(`/programs/days/${input.dayId}/exercises/${input.dayExerciseId}`)
}

export async function reorderDayExercise(input: ReorderDayExerciseInput) {
  const response = await api.patch<DayExercisesResponse>(
    `/programs/days/${input.dayId}/exercises/${input.dayExerciseId}/reorder`,
    { targetIndex: input.targetIndex },
  )

  return response.data.exercises
}
