import { z } from 'zod'

export const exerciseCategorySchema = z.enum(['CHEST', 'BACK', 'SHOULDERS', 'LEGS', 'ARMS', 'CORE'])

export const createExerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: exerciseCategorySchema,
})
