import 'dotenv/config'
import { z } from 'zod'

function isPostgresUrl(value: string) {
  try {
    const url = new URL(value)
    return ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1
  } catch {
    return false
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().refine(isPostgresUrl, 'DATABASE_URL must be a PostgreSQL connection URL'),
  JWT_SECRET: z.string().min(16),
  CLIENT_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default('RepLog <onboarding@resend.dev>'),
  PORT: z.coerce.number().int().positive().default(4000),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('Invalid server environment:', parsedEnv.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsedEnv.data
