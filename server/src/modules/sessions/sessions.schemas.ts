import { z } from 'zod'

export const startSessionSchema = z.object({
  dayId: z.string().min(1),
})

export const addSetSchema = z.object({
  kind: z.enum(['WARMUP', 'NORMAL', 'DROP']).default('NORMAL'),
  notes: z.string().trim().max(300).nullable().optional(),
  weightKg: z.coerce.number().min(0).max(1000),
  reps: z.coerce.number().int().min(1).max(1000),
})

export const addSetChainSchema = z.object({
  parentSetId: z.string().min(1).optional(),
  sets: z.array(
    z.object({
      kind: z.enum(['NORMAL', 'DROP']).default('NORMAL'),
      notes: z.string().trim().max(300).nullable().optional(),
      weightKg: z.coerce.number().min(0).max(1000),
      reps: z.coerce.number().int().min(1).max(1000),
    }),
  ).min(1).max(10),
})

export const updateSetSchema = z.object({
  kind: z.enum(['WARMUP', 'NORMAL', 'DROP']).optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  weightKg: z.coerce.number().min(0).max(1000).optional(),
  reps: z.coerce.number().int().min(1).max(1000).optional(),
})

export const sessionExerciseSchema = z.object({
  exerciseId: z.string().min(1),
})
