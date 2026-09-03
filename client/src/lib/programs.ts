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

export type ProgramSummary = {
  id: string
  name: string
  isActive: boolean
  dayCount: number
  exerciseCount: number
}

export type ProgramTemplate = {
  id: string
  name: string
  description: string
  days: number
  exerciseCount: number
}

type ProgramResponse = {
  program: Program | null
}

type ProgramsResponse = {
  programs: ProgramSummary[]
}

type TemplatesResponse = {
  templates: ProgramTemplate[]
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
  programId: string
  name: string
  badgeColor: DayBadgeColor
}

export type UpdateDayInput = {
  programId: string
  dayId: string
  name?: string
  badgeColor?: DayBadgeColor
}

export type DeleteDayInput = {
  programId: string
  dayId: string
}

export type AddDayExerciseInput = {
  programId: string
  dayId: string
  exerciseId: string
}

export type RemoveDayExerciseInput = {
  programId: string
  dayId: string
  dayExerciseId: string
}

export type ReorderDayExerciseInput = {
  programId: string
  dayId: string
  dayExerciseId: string
  targetIndex: number
}

export type CreateProgramInput = {
  name: string
  source: 'blank' | 'template' | 'copy'
  templateId?: string
  sourceProgramId?: string
}

export const programsQueryKey = ['programs'] as const
export const activeProgramQueryKey = ['programs', 'active'] as const
export const programQueryKey = (programId: string) => ['programs', programId] as const

export function getCopiedProgramName(name: string) {
  const suffix = ' Copy'
  return `${name.slice(0, 80 - suffix.length).trimEnd()}${suffix}`
}

export async function getPrograms() {
  const response = await api.get<ProgramsResponse>('/programs')

  return response.data.programs
}

export async function getProgramTemplates() {
  const response = await api.get<TemplatesResponse>('/programs/templates')

  return response.data.templates
}

export async function getProgram(programId: string) {
  const response = await api.get<ProgramResponse>(`/programs/${programId}`)

  return response.data.program
}

export async function getActiveProgram() {
  const response = await api.get<ProgramResponse>('/programs/active')

  return response.data.program
}

export async function createProgram(input: CreateProgramInput) {
  const response = await api.post<ProgramResponse>('/programs', input)

  return response.data.program
}

export async function updateProgram(programId: string, name: string) {
  const response = await api.patch<ProgramResponse>(`/programs/${programId}`, { name })

  return response.data.program
}

export async function activateProgram(programId: string) {
  const response = await api.post<ProgramResponse>(`/programs/${programId}/activate`)

  return response.data.program
}

export async function deleteProgram(programId: string) {
  await api.delete(`/programs/${programId}`)
}

export async function addDay(input: AddDayInput) {
  const response = await api.post<DayResponse>(`/programs/${input.programId}/days`, {
    name: input.name,
    badgeColor: input.badgeColor,
  })

  return response.data.day
}

export async function updateDay(input: UpdateDayInput) {
  const response = await api.patch<DayResponse>(`/programs/${input.programId}/days/${input.dayId}`, {
    name: input.name,
    badgeColor: input.badgeColor,
  })

  return response.data.day
}

export async function deleteDay(input: DeleteDayInput) {
  await api.delete(`/programs/${input.programId}/days/${input.dayId}`)
}

export async function addDayExercise(input: AddDayExerciseInput) {
  const response = await api.post<DayExerciseResponse>(
    `/programs/${input.programId}/days/${input.dayId}/exercises`,
    { exerciseId: input.exerciseId },
  )

  return response.data.exercise
}

export async function removeDayExercise(input: RemoveDayExerciseInput) {
  await api.delete(`/programs/${input.programId}/days/${input.dayId}/exercises/${input.dayExerciseId}`)
}

export async function reorderDayExercise(input: ReorderDayExerciseInput) {
  const response = await api.patch<DayExercisesResponse>(
    `/programs/${input.programId}/days/${input.dayId}/exercises/${input.dayExerciseId}/reorder`,
    { targetIndex: input.targetIndex },
  )

  return response.data.exercises
}
