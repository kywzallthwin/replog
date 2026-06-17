import { z } from 'zod'

export const updateMeSchema = z.object({
  email: z.string().trim().email(),
  username: z.string().trim().min(2).max(32),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})
