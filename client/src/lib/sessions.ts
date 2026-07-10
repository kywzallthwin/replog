import { api } from './api'

export type WorkoutSet = {
  id: string
  kind: SetKind
  weightKg: number
  reps: number
  order: number
}

export type SetKind = 'WARMUP' | 'NORMAL' | 'DROP'

export type WorkoutExercise = {
  id: string
  exerciseId: string
  name: string
  order: number
  sets: WorkoutSet[]
}

export type WorkoutSession = {
  id: string
  dayId: string | null
  dayName: string
  badgeColor: string
  startedAt: string
  endedAt: string | null
  durationSec: number | null
  exercises: WorkoutExercise[]
}

export type WorkoutHistorySession = {
  id: string
  dayName: string
  badgeColor: string
  startedAt: string
  endedAt: string
  durationSec: number | null
  exerciseCount: number
  setCount: number
}

type SessionResponse = {
  session: WorkoutSession
}

type SessionHistoryResponse = {
  sessions: WorkoutHistorySession[]
}

type SetResponse = {
  set: WorkoutSet
}

type SessionExerciseResponse = {
  exercise: WorkoutExercise
}

export type AddSetInput = {
  sessionId: string
  sessionExerciseId: string
  kind: SetKind
  weightKg: number
  reps: number
}

export type UpdateSetInput = {
  sessionId: string
  sessionExerciseId: string
  setId: string
  kind: SetKind
  weightKg: number
  reps: number
}

export type DeleteSetInput = {
  sessionId: string
  sessionExerciseId: string
  setId: string
}

export type AddSessionExerciseInput = {
  sessionId: string
  exerciseId: string
}

export type SwapSessionExerciseInput = {
  sessionId: string
  sessionExerciseId: string
  exerciseId: string
}

export type RemoveSessionExerciseInput = {
  sessionId: string
  sessionExerciseId: string
}

export function sessionQueryKey(sessionId: string) {
  return ['sessions', sessionId] as const
}

export const sessionHistoryQueryKey = ['sessions', 'history'] as const

export async function startSession(dayId: string) {
  const response = await api.post<SessionResponse>('/sessions', { dayId })

  return response.data.session
}

export async function getSession(sessionId: string) {
  const response = await api.get<SessionResponse>(`/sessions/${sessionId}`)

  return response.data.session
}

export async function getSessionHistory() {
  const response = await api.get<SessionHistoryResponse>('/sessions/history')

  return response.data.sessions
}

export async function addSessionExercise(input: AddSessionExerciseInput) {
  const response = await api.post<SessionExerciseResponse>(`/sessions/${input.sessionId}/exercises`, {
    exerciseId: input.exerciseId,
  })

  return response.data.exercise
}

export async function swapSessionExercise(input: SwapSessionExerciseInput) {
  const response = await api.patch<SessionExerciseResponse>(
    `/sessions/${input.sessionId}/exercises/${input.sessionExerciseId}`,
    { exerciseId: input.exerciseId },
  )

  return response.data.exercise
}

export async function removeSessionExercise(input: RemoveSessionExerciseInput) {
  await api.delete(`/sessions/${input.sessionId}/exercises/${input.sessionExerciseId}`)
}

export async function addSet(input: AddSetInput) {
  const response = await api.post<SetResponse>(
    `/sessions/${input.sessionId}/exercises/${input.sessionExerciseId}/sets`,
    {
      kind: input.kind,
      weightKg: input.weightKg,
      reps: input.reps,
    },
  )

  return response.data.set
}

export async function updateSet(input: UpdateSetInput) {
  const response = await api.patch<SetResponse>(
    `/sessions/${input.sessionId}/exercises/${input.sessionExerciseId}/sets/${input.setId}`,
    {
      kind: input.kind,
      weightKg: input.weightKg,
      reps: input.reps,
    },
  )

  return response.data.set
}

export async function deleteSet(input: DeleteSetInput) {
  await api.delete(`/sessions/${input.sessionId}/exercises/${input.sessionExerciseId}/sets/${input.setId}`)
}

export async function finishSession(sessionId: string) {
  const response = await api.patch<SessionResponse>(`/sessions/${sessionId}/finish`)

  return response.data.session
}
