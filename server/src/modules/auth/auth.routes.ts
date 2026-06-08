import { compare, hash } from 'bcryptjs'
import { Router } from 'express'
import type { User } from '../../generated/prisma/client.js'
import { prisma } from '../../prisma.js'
import { requireAuth } from './auth.middleware.js'
import { loginSchema, registerSchema } from './auth.schemas.js'
import { clearAuthCookie, setAuthCookie } from './auth.tokens.js'

const passwordHashRounds = 12

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

  setAuthCookie(res, user.id)
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

  setAuthCookie(res, user.id)
  res.json({ user: toPublicUser(user) })
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
