import { Router } from 'express'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'
import { createStarterProgramForUser } from './starterProgram.js'
import { createDaySchema, dayExerciseSchema, reorderDayExerciseSchema, updateDaySchema } from './programs.schemas.js'

export const programsRouter = Router()

function toDayExercisePayload(dayExercise: {
  id: string
  exerciseId: string
  order: number
  exercise: { name: string; category: string }
}) {
  return {
    id: dayExercise.id,
    exerciseId: dayExercise.exerciseId,
    name: dayExercise.exercise.name,
    category: dayExercise.exercise.category,
    order: dayExercise.order,
  }
}

function toDayPayload(day: {
  id: string
  name: string
  badgeColor: string
  order: number
  dayExercises: Array<{
    id: string
    exerciseId: string
    order: number
    exercise: { name: string; category: string }
  }>
}) {
  return {
    id: day.id,
    name: day.name,
    badgeColor: day.badgeColor,
    order: day.order,
    exercises: day.dayExercises.map(toDayExercisePayload),
  }
}

function toProgramPayload(program: {
  id: string
  name: string
  isActive: boolean
  days: Array<Parameters<typeof toDayPayload>[0]>
}) {
  return {
    id: program.id,
    name: program.name,
    isActive: program.isActive,
    days: program.days.map(toDayPayload),
  }
}

programsRouter.get('/active', requireAuth, async (req, res) => {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  await createStarterProgramForUser(userId)

  const activeProgram = await prisma.program.findFirst({
    where: {
      ownerId: userId,
      isActive: true,
    },
    include: {
      days: {
        orderBy: { order: 'asc' },
        include: {
          dayExercises: {
            orderBy: { order: 'asc' },
            include: { exercise: true },
          },
        },
      },
    },
  })

  res.json({ program: activeProgram ? toProgramPayload(activeProgram) : null })
})

programsRouter.post('/active/days', requireAuth, async (req, res) => {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const parsedBody = createDaySchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const activeProgram = await prisma.program.findFirst({
    where: {
      ownerId: userId,
      isActive: true,
    },
  })

  if (!activeProgram) {
    res.status(404).json({ error: 'Active program not found' })
    return
  }

  const latestDay = await prisma.day.findFirst({
    where: { programId: activeProgram.id },
    orderBy: { order: 'desc' },
  })

  const day = await prisma.day.create({
    data: {
      programId: activeProgram.id,
      name: parsedBody.data.name,
      badgeColor: parsedBody.data.badgeColor,
      order: (latestDay?.order ?? 0) + 1,
    },
    include: {
      dayExercises: {
        orderBy: { order: 'asc' },
        include: { exercise: true },
      },
    },
  })

  res.status(201).json({ day: toDayPayload(day) })
})

programsRouter.patch('/days/:dayId', requireAuth, async (req, res) => {
  const userId = req.userId
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!dayId) {
    res.status(400).json({ error: 'Invalid day id' })
    return
  }

  const parsedBody = updateDaySchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const day = await prisma.day.findFirst({
    where: {
      id: dayId,
      program: { ownerId: userId, isActive: true },
    },
  })

  if (!day) {
    res.status(404).json({ error: 'Day not found' })
    return
  }

  const updateData: { name?: string; badgeColor?: string } = {}

  if (parsedBody.data.name !== undefined) {
    updateData.name = parsedBody.data.name
  }

  if (parsedBody.data.badgeColor !== undefined) {
    updateData.badgeColor = parsedBody.data.badgeColor
  }

  const updatedDay = await prisma.day.update({
    where: { id: dayId },
    data: updateData,
    include: {
      dayExercises: {
        orderBy: { order: 'asc' },
        include: { exercise: true },
      },
    },
  })

  res.json({ day: toDayPayload(updatedDay) })
})

programsRouter.delete('/days/:dayId', requireAuth, async (req, res) => {
  const userId = req.userId
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!dayId) {
    res.status(400).json({ error: 'Invalid day id' })
    return
  }

  const day = await prisma.day.findFirst({
    where: {
      id: dayId,
      program: { ownerId: userId, isActive: true },
    },
  })

  if (!day) {
    res.status(404).json({ error: 'Day not found' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.day.delete({ where: { id: dayId } })

    const laterDays = await tx.day.findMany({
      where: {
        programId: day.programId,
        order: { gt: day.order },
      },
      orderBy: { order: 'asc' },
    })

    for (const [index, laterDay] of laterDays.entries()) {
      await tx.day.update({
        where: { id: laterDay.id },
        data: { order: day.order + index },
      })
    }
  })

  res.status(204).send()
})

programsRouter.post('/days/:dayId/exercises', requireAuth, async (req, res) => {
  const userId = req.userId
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!dayId) {
    res.status(400).json({ error: 'Invalid day id' })
    return
  }

  const parsedBody = dayExerciseSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const day = await prisma.day.findFirst({
    where: {
      id: dayId,
      program: { ownerId: userId, isActive: true },
    },
  })

  if (!day) {
    res.status(404).json({ error: 'Day not found' })
    return
  }

  const exercise = await prisma.exercise.findFirst({
    where: {
      id: parsedBody.data.exerciseId,
      OR: [{ ownerId: null }, { ownerId: userId }],
    },
  })

  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' })
    return
  }

  const existingDayExercise = await prisma.dayExercise.findFirst({
    where: { dayId, exerciseId: exercise.id },
  })

  if (existingDayExercise) {
    res.status(409).json({ error: 'Exercise is already in this program day' })
    return
  }

  const latestDayExercise = await prisma.dayExercise.findFirst({
    where: { dayId },
    orderBy: { order: 'desc' },
  })

  const dayExercise = await prisma.dayExercise.create({
    data: {
      dayId,
      exerciseId: exercise.id,
      order: (latestDayExercise?.order ?? 0) + 1,
    },
    include: { exercise: true },
  })

  res.status(201).json({ exercise: toDayExercisePayload(dayExercise) })
})

programsRouter.delete('/days/:dayId/exercises/:dayExerciseId', requireAuth, async (req, res) => {
  const userId = req.userId
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null
  const dayExerciseId = typeof req.params.dayExerciseId === 'string' ? req.params.dayExerciseId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!dayId || !dayExerciseId) {
    res.status(400).json({ error: 'Invalid day or exercise id' })
    return
  }

  const dayExercise = await prisma.dayExercise.findFirst({
    where: {
      id: dayExerciseId,
      dayId,
      day: { program: { ownerId: userId, isActive: true } },
    },
  })

  if (!dayExercise) {
    res.status(404).json({ error: 'Day exercise not found' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.dayExercise.delete({ where: { id: dayExerciseId } })

    const laterExercises = await tx.dayExercise.findMany({
      where: {
        dayId,
        order: { gt: dayExercise.order },
      },
      orderBy: { order: 'asc' },
    })

    for (const [index, laterExercise] of laterExercises.entries()) {
      await tx.dayExercise.update({
        where: { id: laterExercise.id },
        data: { order: dayExercise.order + index },
      })
    }
  })

  res.status(204).send()
})

programsRouter.patch('/days/:dayId/exercises/:dayExerciseId/reorder', requireAuth, async (req, res) => {
  const userId = req.userId
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null
  const dayExerciseId = typeof req.params.dayExerciseId === 'string' ? req.params.dayExerciseId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!dayId || !dayExerciseId) {
    res.status(400).json({ error: 'Invalid day or exercise id' })
    return
  }

  const parsedBody = reorderDayExerciseSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const target = await prisma.dayExercise.findFirst({
    where: {
      id: dayExerciseId,
      dayId,
      day: { program: { ownerId: userId, isActive: true } },
    },
  })

  if (!target) {
    res.status(404).json({ error: 'Day exercise not found' })
    return
  }

  const exercisesInDay = await prisma.dayExercise.findMany({
    where: { dayId },
    orderBy: { order: 'asc' },
    include: { exercise: true },
  })
  const sourceIndex = exercisesInDay.findIndex((exercise) => exercise.id === target.id)
  const targetIndex = parsedBody.data.targetIndex
  let orderedExercises = exercisesInDay

  if (sourceIndex < 0 || targetIndex >= exercisesInDay.length) {
    res.status(400).json({ error: 'Invalid target exercise position' })
    return
  }

  if (sourceIndex !== targetIndex) {
    const reordered = [...exercisesInDay]
    const [movedExercise] = reordered.splice(sourceIndex, 1)

    if (!movedExercise) {
      res.status(400).json({ error: 'Invalid target exercise position' })
      return
    }

    reordered.splice(targetIndex, 0, movedExercise)
    orderedExercises = reordered

    await prisma.$transaction(async (tx) => {
      for (const [index, exercise] of reordered.entries()) {
        await tx.dayExercise.update({ where: { id: exercise.id }, data: { order: -(index + 1) } })
      }

      for (const [index, exercise] of reordered.entries()) {
        await tx.dayExercise.update({ where: { id: exercise.id }, data: { order: index + 1 } })
      }
    })
  }

  res.json({ exercises: orderedExercises.map((exercise, index) => toDayExercisePayload({ ...exercise, order: index + 1 })) })
})
