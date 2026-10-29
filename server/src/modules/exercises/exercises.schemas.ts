import { z } from 'zod'

export const createExerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  categoryId: z.string().min(1),
})

export const mergeExerciseSchema = z.object({
  targetExerciseId: z.string().trim().min(1),
})

export const updateExerciseSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    categoryId: z.string().min(1).optional(),
  })
  .refine((value) => value.name !== undefined || value.categoryId !== undefined, {
    message: 'Provide a name or a category',
  })

export const categoryNameSchema = z.string().trim().min(1).max(80)
