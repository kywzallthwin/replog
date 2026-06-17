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

type SessionResponse = {
  session: WorkoutSession
}

type SetResponse = {
  set: WorkoutSet
}

export type AddSetInput = {
  sessionId: string
  sessionExerciseId: string
  kind: SetKind
  weightKg: number
  reps: number
}

export function sessionQueryKey(sessionId: string) {
  return ['sessions', sessionId] as const
}

export async function startSession(dayId: string) {
  const response = await api.post<SessionResponse>('/sessions', { dayId })

  return response.data.session
}

export async function getSession(sessionId: string) {
  const response = await api.get<SessionResponse>(`/sessions/${sessionId}`)

  return response.data.session
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
