import { Router } from 'express'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'
import { addSetSchema, startSessionSchema } from './sessions.schemas.js'

export const sessionsRouter = Router()

function toSessionPayload(session: {
  id: string
  dayId: string | null
  dayNameSnapshot: string
  badgeColorSnapshot: string
  startedAt: Date
  endedAt: Date | null
  durationSec: number | null
  sessionExercises: Array<{
    id: string
    exerciseId: string
    nameSnapshot: string
    order: number
    setLogs: Array<{
      id: string
      kind: string
      weightKg: number
      reps: number
      order: number
    }>
  }>
}) {
  return {
    id: session.id,
    dayId: session.dayId,
    dayName: session.dayNameSnapshot,
    badgeColor: session.badgeColorSnapshot,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSec: session.durationSec,
    exercises: session.sessionExercises.map((sessionExercise) => ({
      id: sessionExercise.id,
      exerciseId: sessionExercise.exerciseId,
      name: sessionExercise.nameSnapshot,
      order: sessionExercise.order,
      sets: sessionExercise.setLogs.map((setLog) => ({
        id: setLog.id,
        kind: setLog.kind,
        weightKg: setLog.weightKg,
        reps: setLog.reps,
        order: setLog.order,
      })),
    })),
  }
}

sessionsRouter.post('/', requireAuth, async (req, res) => {
  const parsedBody = startSessionSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const day = await prisma.day.findFirst({
    where: {
      id: parsedBody.data.dayId,
      program: { ownerId: userId },
    },
    include: {
      dayExercises: {
        orderBy: { order: 'asc' },
        include: { exercise: true },
      },
    },
  })

  if (!day) {
    res.status(404).json({ error: 'Workout day not found' })
    return
  }

  const session = await prisma.session.create({
    data: {
      userId,
      dayId: day.id,
      dayNameSnapshot: day.name,
      badgeColorSnapshot: day.badgeColor,
      sessionExercises: {
        create: day.dayExercises.map((dayExercise) => ({
          exerciseId: dayExercise.exerciseId,
          nameSnapshot: dayExercise.exercise.name,
          order: dayExercise.order,
        })),
      },
    },
    include: {
      sessionExercises: {
        orderBy: { order: 'asc' },
        include: {
          setLogs: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  })

  res.status(201).json({ session: toSessionPayload(session) })
})

sessionsRouter.get('/:sessionId', requireAuth, async (req, res) => {
  const userId = req.userId
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!sessionId) {
    res.status(400).json({ error: 'Invalid session id' })
    return
  }

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    include: {
      sessionExercises: {
        orderBy: { order: 'asc' },
        include: {
          setLogs: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  })

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  res.json({ session: toSessionPayload(session) })
})

sessionsRouter.post('/:sessionId/exercises/:sessionExerciseId/sets', requireAuth, async (req, res) => {
  const userId = req.userId
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : null
  const sessionExerciseId = typeof req.params.sessionExerciseId === 'string' ? req.params.sessionExerciseId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!sessionId || !sessionExerciseId) {
    res.status(400).json({ error: 'Invalid session or exercise id' })
    return
  }

  const parsedBody = addSetSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const sessionExercise = await prisma.sessionExercise.findFirst({
    where: {
      id: sessionExerciseId,
      sessionId,
      session: { userId },
    },
  })

  if (!sessionExercise) {
    res.status(404).json({ error: 'Session exercise not found' })
    return
  }

  const latestSet = await prisma.setLog.findFirst({
    where: { sessionExerciseId },
    orderBy: { order: 'desc' },
  })
  const setLog = await prisma.setLog.create({
    data: {
      sessionExerciseId,
      kind: parsedBody.data.kind,
      weightKg: parsedBody.data.weightKg,
      reps: parsedBody.data.reps,
      order: (latestSet?.order ?? 0) + 1,
    },
  })

  res.status(201).json({
    set: {
      id: setLog.id,
      kind: setLog.kind,
      weightKg: setLog.weightKg,
      reps: setLog.reps,
      order: setLog.order,
    },
  })
})
