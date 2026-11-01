import { z } from 'zod'

export const weightUnitSchema = z.enum(['KG', 'LB'])

export const updateMeSchema = z
  .object({
    email: z.string().trim().email().optional(),
    username: z.string().trim().min(2).max(32).optional(),
    weightUnit: weightUnitSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasProfileFields = data.email !== undefined || data.username !== undefined
    const hasWeightUnit = data.weightUnit !== undefined

    if (!hasProfileFields && !hasWeightUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide profile details or weightUnit',
      })
      return
    }

    if (hasProfileFields) {
      if (data.email === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: 'Required',
        })
      }
      if (data.username === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['username'],
          message: 'Required',
        })
      }
    }
  })

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})
