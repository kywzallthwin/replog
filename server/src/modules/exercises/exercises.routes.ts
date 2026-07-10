import { Router } from 'express'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'

export const exercisesRouter = Router()

exercisesRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [{ ownerId: null }, { ownerId: userId }],
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  res.json({
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
    })),
  })
})
