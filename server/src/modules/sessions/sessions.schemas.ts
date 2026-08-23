import { z } from 'zod'

export const startSessionSchema = z.object({
  dayId: z.string().min(1),
})

export const addSetSchema = z.object({
  kind: z.enum(['WARMUP', 'NORMAL', 'DROP']).default('NORMAL'),
  weightKg: z.coerce.number().min(0).max(1000),
  reps: z.coerce.number().int().min(1).max(1000),
})

export const updateSetSchema = z.object({
  kind: z.enum(['WARMUP', 'NORMAL', 'DROP']).optional(),
  weightKg: z.coerce.number().min(0).max(1000).optional(),
  reps: z.coerce.number().int().min(1).max(1000).optional(),
})

export const sessionExerciseSchema = z.object({
  exerciseId: z.string().min(1),
})

export const updateSessionNotesSchema = z.object({
  notes: z.string().trim().max(2000),
})
