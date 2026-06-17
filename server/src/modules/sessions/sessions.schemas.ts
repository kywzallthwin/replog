import { z } from 'zod'

export const startSessionSchema = z.object({
  dayId: z.string().min(1),
})
