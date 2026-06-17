import { compare, hash } from 'bcryptjs'
import { Router } from 'express'
import type { User } from '../../generated/prisma/client.js'
import { requireAuth } from '../auth/auth.middleware.js'
import { prisma } from '../../prisma.js'
import { changePasswordSchema, updateMeSchema } from './users.schemas.js'

const passwordHashRounds = 12

export const usersRouter = Router()

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

usersRouter.patch('/me', requireAuth, async (req, res) => {
  const parsedBody = updateMeSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const email = parsedBody.data.email.toLowerCase()
  const { username } = parsedBody.data
  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      NOT: { id: userId },
    },
  })

  if (existingUser) {
    res.status(409).json({ error: 'Email is already registered' })
    return
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      username,
      avatarInitial: getAvatarInitial(username, email),
    },
  })

  res.json({ user: toPublicUser(user) })
})

usersRouter.post('/me/password', requireAuth, async (req, res) => {
  const parsedBody = changePasswordSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!user.passwordHash) {
    res.status(400).json({ error: 'Password sign-in is not enabled for this account' })
    return
  }

  const isCurrentPasswordValid = await compare(parsedBody.data.currentPassword, user.passwordHash)

  if (!isCurrentPasswordValid) {
    res.status(401).json({ error: 'Current password is incorrect' })
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hash(parsedBody.data.newPassword, passwordHashRounds),
    },
  })

  res.status(204).send()
})
