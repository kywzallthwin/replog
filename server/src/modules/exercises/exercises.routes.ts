import { Router } from 'express'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'
import { createExerciseSchema } from './exercises.schemas.js'

export const exercisesRouter = Router()

function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function toExercisePayload(exercise: { id: string; name: string; category: string; ownerId: string | null }) {
  return {
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    isCustom: exercise.ownerId !== null,
  }
}

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
    exercises: exercises.map(toExercisePayload),
  })
})

exercisesRouter.post('/', requireAuth, async (req, res) => {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const parsedBody = createExerciseSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const normalizedName = normalizeExerciseName(parsedBody.data.name)
  const visibleExercises = await prisma.exercise.findMany({
    where: {
      OR: [{ ownerId: null }, { ownerId: userId }],
    },
    select: { name: true },
  })

  if (visibleExercises.some((exercise) => normalizeExerciseName(exercise.name) === normalizedName)) {
    res.status(409).json({ error: 'An exercise with this name already exists' })
    return
  }

  const exercise = await prisma.exercise.create({
    data: {
      name: parsedBody.data.name,
      category: parsedBody.data.category,
      ownerId: userId,
    },
  })

  res.status(201).json({ exercise: toExercisePayload(exercise) })
})
