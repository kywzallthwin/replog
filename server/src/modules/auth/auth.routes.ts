import { compare, hash } from 'bcryptjs'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Router, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { OAuth2Client } from 'google-auth-library'
import type { User } from '../../generated/prisma/client.js'
import { env } from '../../env.js'
import { prisma } from '../../prisma.js'
import { createStarterProgramForUser } from '../programs/starterProgram.js'
import { sendPasswordResetEmail } from './auth.email.js'
import { requireAuth } from './auth.middleware.js'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas.js'
import { clearAuthCookie, setAuthCookie } from './auth.tokens.js'

const passwordHashRounds = 12
const passwordResetLifetimeMs = 1000 * 60 * 60
const forgotPasswordMinimumResponseMs = 300
const forgotPasswordResponse = {
  message: 'If an account exists for that email, a password reset link has been sent.',
}
const googleStateCookieName = 'replog_google_state'
const googleStateLifetimeMs = 10 * 60 * 1000

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Please try again later.' },
})

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many reset attempts. Please try again later.' },
})

const googleOAuthClient =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL)
    : null

export const authRouter = Router()

function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarInitial: user.avatarInitial,
    createdAt: user.createdAt,
  }
}

function getAvatarInitial(username: string, email: string) {
  return (username.trim()[0] ?? email.trim()[0] ?? 'U').toUpperCase()
}

function getPasswordResetTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function getGoogleCallbackUrl() {
  return env.GOOGLE_CALLBACK_URL ?? `http://localhost:${env.PORT}/auth/google/callback`
}

function redirectFromGoogle(res: Response, error?: string) {
  const redirectUrl = new URL('/login', env.CLIENT_URL)

  if (error) {
    redirectUrl.searchParams.set('google_error', error)
  }

  res.redirect(redirectUrl.toString())
}

function clearGoogleStateCookie(res: Response) {
  res.clearCookie(googleStateCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/auth/google',
  })
}

function getGoogleUsername(name: string | undefined, email: string) {
  const candidate = (name?.trim() || email.split('@')[0] || 'User').slice(0, 32)
  return candidate.length >= 2 ? candidate : `${candidate} User`.slice(0, 32)
}

function getGoogleAvatarInitial(username: string, email: string) {
  return (username[0] ?? email[0] ?? 'U').toUpperCase()
}

authRouter.get('/google', (_req, res) => {
  if (!googleOAuthClient || !env.GOOGLE_CLIENT_ID) {
    redirectFromGoogle(res, 'not_configured')
    return
  }

  const state = randomBytes(32).toString('hex')
  res.cookie(googleStateCookieName, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: googleStateLifetimeMs,
    path: '/auth/google',
  })

  res.redirect(
    googleOAuthClient.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
      include_granted_scopes: true,
      redirect_uri: getGoogleCallbackUrl(),
    }),
  )
})

authRouter.get('/google/callback', async (req, res) => {
  const stateCookie = req.cookies?.[googleStateCookieName]
  clearGoogleStateCookie(res)

  if (!googleOAuthClient || !env.GOOGLE_CLIENT_ID || typeof stateCookie !== 'string') {
    redirectFromGoogle(res, 'invalid_state')
    return
  }

  const state = typeof req.query.state === 'string' ? req.query.state : ''

  try {
    const expected = Buffer.from(stateCookie)
    const received = Buffer.from(state)

    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      redirectFromGoogle(res, 'invalid_state')
      return
    }

    if (typeof req.query.error === 'string') {
      redirectFromGoogle(res, req.query.error === 'access_denied' ? 'cancelled' : 'provider_error')
      return
    }

    const code = typeof req.query.code === 'string' ? req.query.code : null

    if (!code) {
      redirectFromGoogle(res, 'missing_code')
      return
    }

    const { tokens } = await googleOAuthClient.getToken({ code, redirect_uri: getGoogleCallbackUrl() })

    if (!tokens.id_token) {
      redirectFromGoogle(res, 'missing_identity')
      return
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    const googleId = payload?.sub
    const email = payload?.email?.trim().toLowerCase()

    if (!googleId || !email || payload.email_verified !== true) {
      redirectFromGoogle(res, 'unverified_email')
      return
    }

    let user = await prisma.user.findUnique({ where: { googleId } })

    if (!user) {
      const existingUser = await prisma.user.findUnique({ where: { email } })

      if (existingUser?.googleId && existingUser.googleId !== googleId) {
        redirectFromGoogle(res, 'account_conflict')
        return
      }

      user = existingUser
        ? await prisma.user.update({ where: { id: existingUser.id }, data: { googleId } })
        : await prisma.user.create({
            data: {
              email,
              username: getGoogleUsername(payload.name, email),
              googleId,
              avatarInitial: getGoogleAvatarInitial(payload.name ?? '', email),
            },
          })

      if (!existingUser) {
        await createStarterProgramForUser(user.id)
      }
    }

    setAuthCookie(res, user.id, user.authVersion)
    redirectFromGoogle(res)
  } catch (error) {
    console.error('Google OAuth callback failed:', error instanceof Error ? error.message : 'Unknown error')
    redirectFromGoogle(res, 'provider_error')
  }
})

authRouter.post('/register', async (req, res) => {
  const parsedBody = registerSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const email = parsedBody.data.email.toLowerCase()
  const { username, password } = parsedBody.data

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    res.status(409).json({ error: 'Email is already registered' })
    return
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash: await hash(password, passwordHashRounds),
      avatarInitial: getAvatarInitial(username, email),
    },
  })

  await createStarterProgramForUser(user.id)

  setAuthCookie(res, user.id, user.authVersion)
  res.status(201).json({ user: toPublicUser(user) })
})

authRouter.post('/login', async (req, res) => {
  const parsedBody = loginSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const user = await prisma.user.findUnique({
    where: { email: parsedBody.data.email.toLowerCase() },
  })

  if (!user?.passwordHash) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const isPasswordValid = await compare(parsedBody.data.password, user.passwordHash)

  if (!isPasswordValid) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  setAuthCookie(res, user.id, user.authVersion)
  res.json({ user: toPublicUser(user) })
})

authRouter.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const startedAt = Date.now()
  const parsedBody = forgotPasswordSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  if (!env.RESEND_API_KEY) {
    res.status(503).json({ error: 'Password reset email is not configured' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { email: parsedBody.data.email.toLowerCase() },
  })

  if (user) {
    const token = randomBytes(32).toString('hex')
    const tokenHash = getPasswordResetTokenHash(token)
    const expiresAt = new Date(Date.now() + passwordResetLifetimeMs)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    })

    const resetUrl = new URL('/reset-password', env.CLIENT_URL)
    resetUrl.searchParams.set('token', token)

    void sendPasswordResetEmail(user.email, resetUrl.toString()).catch((error) => {
      console.error(error instanceof Error ? error.message : 'Password reset email delivery failed')
      void prisma.user
        .updateMany({
          where: { id: user.id, passwordResetTokenHash: tokenHash },
          data: {
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
          },
        })
        .catch(() => console.error('Unable to clear the undelivered password reset token'))
    })
  }

  const responseDelayMs = forgotPasswordMinimumResponseMs - (Date.now() - startedAt)

  if (responseDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, responseDelayMs))
  }

  res.status(202).json(forgotPasswordResponse)
})

authRouter.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  const parsedBody = resetPasswordSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const tokenHash = getPasswordResetTokenHash(parsedBody.data.token)
  const passwordHash = await hash(parsedBody.data.newPassword, passwordHashRounds)
  const result = await prisma.user.updateMany({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { gt: new Date() },
    },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      authVersion: { increment: 1 },
    },
  })

  if (result.count === 0) {
    res.status(400).json({ error: 'This password reset link is invalid or has expired' })
    return
  }

  clearAuthCookie(res)
  res.status(204).send()
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    clearAuthCookie(res)
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  res.json({ user: toPublicUser(user) })
})

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.status(204).send()
})
