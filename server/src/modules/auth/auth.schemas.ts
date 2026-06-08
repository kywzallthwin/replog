import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().trim().email(),
  username: z.string().trim().min(2).max(32),
  password: z.string().min(8).max(128),
})

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})
