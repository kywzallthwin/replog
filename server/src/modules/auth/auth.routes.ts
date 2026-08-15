import { compare, hash } from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
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
