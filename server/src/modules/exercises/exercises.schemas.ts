import { z } from 'zod'

export const createExerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  categoryId: z.string().min(1),
})

export const mergeExerciseSchema = z.object({
  targetExerciseId: z.string().trim().min(1),
})

export const categoryNameSchema = z.string().trim().min(1).max(80)
