import 'dotenv/config'
import { z } from 'zod'

export const nodeEnvironments = ['development', 'test', 'ci', 'production'] as const
export type NodeEnvironment = (typeof nodeEnvironments)[number]

function isPostgresUrl(value: string) {
  try {
    const url = new URL(value)
    return ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1
  } catch {
    return false
  }
}

function isSecurePostgresUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      isPostgresUrl(value) &&
      ['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '')
    )
  } catch {
    return false
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

function isHttpOrigin(value: string) {
  try {
    const url = new URL(value)
    return isHttpUrl(value) && !url.hostname.includes('*') && !url.search && !url.hash && url.pathname === '/'
  } catch {
    return false
  }
}

function parseOrigins(value: string | undefined) {
  if (!value) return []
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean)
  return origins.map(normalizeOrigin)
}

function isValidOriginList(value: string) {
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean)
  return origins.length > 0 && origins.every(isHttpOrigin)
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback
  return value === 'true'
}

function isBoolean(value: string | undefined) {
  return value === undefined || value === 'true' || value === 'false'
}

function normalizeOrigin(value: string) {
  return new URL(value).origin
}

const envSchema = z.object({
  DATABASE_URL: z.string().refine(isPostgresUrl, 'DATABASE_URL must be a PostgreSQL connection URL'),
  DATABASE_URL_UNPOOLED: z.string().refine(isPostgresUrl, 'DATABASE_URL_UNPOOLED must be a PostgreSQL connection URL').optional(),
  JWT_SECRET: z.string().min(16),
  NODE_ENV: z.enum(nodeEnvironments).default('development'),
  CLIENT_URL: z.string().refine(isHttpOrigin, 'CLIENT_URL must be an HTTP(S) origin').transform(normalizeOrigin),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALLBACK_URL: z.string().refine(isHttpUrl, 'GOOGLE_CALLBACK_URL must be an HTTP(S) URL').optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default('RepLog <onboarding@resend.dev>'),
  PORT: z.coerce.number().int().positive().default(4000),
  ADDITIONAL_CLIENT_ORIGINS: z.string().optional().refine(
    (value) => value === undefined || value.trim() === '' || isValidOriginList(value),
    'ADDITIONAL_CLIENT_ORIGINS must contain exact HTTP(S) origins',
  ).transform(parseOrigins),
  EDGE_PROXY_SECRET: z.string().min(1).optional(),
  REQUIRE_EDGE_PROXY: z.string().optional().refine(isBoolean, 'REQUIRE_EDGE_PROXY must be true or false').transform((value) => parseBoolean(value, false)),
  SERVE_CLIENT: z.string().optional().refine(isBoolean, 'SERVE_CLIENT must be true or false').transform((value) => parseBoolean(value, false)),
}).superRefine((value, context) => {
  const hasGoogleCredentials = Boolean(value.GOOGLE_CLIENT_ID || value.GOOGLE_CLIENT_SECRET)

  if (hasGoogleCredentials && (!value.GOOGLE_CLIENT_ID || !value.GOOGLE_CLIENT_SECRET || !value.GOOGLE_CALLBACK_URL)) {
    context.addIssue({
      code: 'custom',
      path: ['GOOGLE_CLIENT_ID'],
      message: 'Google OAuth requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL',
    })
  }

  if (value.NODE_ENV === 'production') {
    if (value.REQUIRE_EDGE_PROXY && !value.EDGE_PROXY_SECRET) {
      context.addIssue({ code: 'custom', path: ['EDGE_PROXY_SECRET'], message: 'EDGE_PROXY_SECRET is required when edge proxy enforcement is enabled' })
    }
    if (!isSecurePostgresUrl(value.DATABASE_URL)) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL must require TLS in production',
      })
    }

    if (!value.DATABASE_URL_UNPOOLED) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL_UNPOOLED'],
        message: 'DATABASE_URL_UNPOOLED is required in production',
      })
    } else if (!isSecurePostgresUrl(value.DATABASE_URL_UNPOOLED)) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL_UNPOOLED'],
        message: 'DATABASE_URL_UNPOOLED must require TLS in production',
      })
    }

    if (!value.CLIENT_URL.startsWith('https://')) {
      context.addIssue({
        code: 'custom',
        path: ['CLIENT_URL'],
        message: 'CLIENT_URL must use HTTPS in production',
      })
    }

    if (value.ADDITIONAL_CLIENT_ORIGINS.some((origin) => !origin.startsWith('https://'))) {
      context.addIssue({
        code: 'custom',
        path: ['ADDITIONAL_CLIENT_ORIGINS'],
        message: 'ADDITIONAL_CLIENT_ORIGINS must use HTTPS in production',
      })
    }

    if (value.JWT_SECRET.length < 32 || value.JWT_SECRET.startsWith('replace-with-at-least-')) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be a unique secret of at least 32 characters in production',
      })
    }

    if (value.GOOGLE_CALLBACK_URL && !value.GOOGLE_CALLBACK_URL.startsWith('https://')) {
      context.addIssue({
        code: 'custom',
        path: ['GOOGLE_CALLBACK_URL'],
        message: 'GOOGLE_CALLBACK_URL must use HTTPS in production',
      })
    }
  }
})

export function parseEnvironment(input: Record<string, string | undefined>) {
  const parsedEnv = envSchema.safeParse(input)

  if (!parsedEnv.success) {
    console.error('Invalid server environment:', parsedEnv.error.flatten().fieldErrors)
    throw new Error('Invalid server environment')
  }

  return parsedEnv.data
}

export const env = parseEnvironment(process.env)
