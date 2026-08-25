import { Router } from 'express'
import { isBetterEstimatedSet } from '../../estimatedOneRepMax.js'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'
import {
  addSetSchema,
  addSetChainSchema,
  finishSessionSchema,
  sessionExerciseSchema,
  startSessionSchema,
  updateSessionNotesSchema,
  updateSetSchema,
} from './sessions.schemas.js'

export const sessionsRouter = Router()

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

type SessionSetPayload = {
  id: string
  kind: string
  parentSetId: string | null
  notes: string | null
  weightKg: number
  reps: number
  order: number
}

type LastTimeReference = {
  sessionId: string
  performedAt: Date
  weightKg: number
  reps: number
}

type PreviousWorkoutReference = {
  sessionId: string
  performedAt: Date
  sets: SessionSetPayload[]
  bestNormalSetId: string | null
}

function toSetPayload(setLog: SessionSetPayload) {
  return {
    id: setLog.id,
    kind: setLog.kind,
    parentSetId: setLog.parentSetId,
    notes: setLog.notes,
    weightKg: setLog.weightKg,
    reps: setLog.reps,
    order: setLog.order,
  }
}

function toSessionPayload(session: {
  id: string
  programId: string | null
  programNameSnapshot: string | null
  dayId: string | null
  dayNameSnapshot: string
  badgeColorSnapshot: string
  startedAt: Date
  endedAt: Date | null
  durationSec: number | null
  notes: string | null
  sessionExercises: Array<{
    id: string
    exerciseId: string
    nameSnapshot: string
    order: number
    setLogs: SessionSetPayload[]
  }>
},
lastTimeReferences = new Map<string, LastTimeReference>(),
previousWorkoutReferences = new Map<string, PreviousWorkoutReference>()) {
  return {
    id: session.id,
    programId: session.programId,
    programName: session.programNameSnapshot,
    dayId: session.dayId,
    dayName: session.dayNameSnapshot,
    badgeColor: session.badgeColorSnapshot,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSec: session.durationSec,
    notes: session.notes,
    exercises: session.sessionExercises.map((sessionExercise) => ({
      id: sessionExercise.id,
      exerciseId: sessionExercise.exerciseId,
      name: sessionExercise.nameSnapshot,
      order: sessionExercise.order,
      sets: sessionExercise.setLogs.map(toSetPayload),
      lastTime: lastTimeReferences.get(sessionExercise.exerciseId) ?? null,
      previousWorkout: previousWorkoutReferences.get(sessionExercise.exerciseId) ?? null,
    })),
  }
}

function toSessionExercisePayload(sessionExercise: {
  id: string
  exerciseId: string
  nameSnapshot: string
  order: number
  setLogs: SessionSetPayload[]
}) {
  return {
    id: sessionExercise.id,
    exerciseId: sessionExercise.exerciseId,
    name: sessionExercise.nameSnapshot,
    order: sessionExercise.order,
    sets: sessionExercise.setLogs.map(toSetPayload),
    lastTime: null,
    previousWorkout: null,
  }
}

async function getPreviousPerformanceReferences(userId: string, currentStartedAt: Date, exerciseIds: string[]) {
  const lastTimeReferences = new Map<string, LastTimeReference>()
  const previousWorkoutReferences = new Map<string, PreviousWorkoutReference>()

  if (!exerciseIds.length) {
    return { lastTimeReferences, previousWorkoutReferences }
  }

  const previousSessions = await prisma.session.findMany({
    where: {
      userId,
      endedAt: { not: null },
      startedAt: { lt: currentStartedAt },
      sessionExercises: {
        some: {
          exerciseId: { in: exerciseIds },
          setLogs: { some: {} },
        },
      },
    },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    include: {
      sessionExercises: {
        where: { exerciseId: { in: exerciseIds } },
        include: {
          setLogs: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  })

  for (const previousSession of previousSessions) {
    for (const previousExercise of previousSession.sessionExercises) {
      if (!previousExercise.setLogs.length) {
        continue
      }

      const normalSets = previousExercise.setLogs.filter((setLog) => setLog.kind === 'NORMAL')
      const bestNormalSet = normalSets.reduce<(typeof normalSets)[number] | null>(
        (best, candidate) => (isBetterEstimatedSet(candidate, best) ? candidate : best),
        null,
      )

      if (!previousWorkoutReferences.has(previousExercise.exerciseId)) {
        previousWorkoutReferences.set(previousExercise.exerciseId, {
          sessionId: previousSession.id,
          performedAt: previousSession.startedAt,
          sets: previousExercise.setLogs.map(toSetPayload),
          bestNormalSetId: bestNormalSet?.id ?? null,
        })
      }

      if (bestNormalSet && !lastTimeReferences.has(previousExercise.exerciseId)) {
        lastTimeReferences.set(previousExercise.exerciseId, {
          sessionId: previousSession.id,
          performedAt: previousSession.startedAt,
          weightKg: bestNormalSet.weightKg,
          reps: bestNormalSet.reps,
        })
      }
    }

    if (previousWorkoutReferences.size === exerciseIds.length && lastTimeReferences.size === exerciseIds.length) {
      break
    }
  }

  return { lastTimeReferences, previousWorkoutReferences }
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

  const activeSession = await prisma.session.findFirst({
    where: { userId, endedAt: null },
    select: { id: true },
  })

  if (activeSession) {
    res.status(409).json({
      error: 'Finish or cancel the active workout before starting another',
      activeSessionId: activeSession.id,
    })
    return
  }

  const day = await prisma.day.findFirst({
    where: {
      id: parsedBody.data.dayId,
      program: { ownerId: userId, isActive: true },
    },
    include: {
      program: {
        select: {
          id: true,
          name: true,
        },
      },
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

  let session

  try {
    session = await prisma.session.create({
      data: {
        userId,
        programId: day.program.id,
        programNameSnapshot: day.program.name,
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
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const activeSessionAfterRace = await prisma.session.findFirst({
      where: { userId, endedAt: null },
      select: { id: true },
    })

    res.status(409).json({
      error: 'Finish or cancel the active workout before starting another',
      activeSessionId: activeSessionAfterRace?.id,
    })
    return
  }

  res.status(201).json({ session: toSessionPayload(session) })
})

sessionsRouter.get('/history', requireAuth, async (req, res) => {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      endedAt: { not: null },
    },
    orderBy: { startedAt: 'desc' },
    include: {
      sessionExercises: {
        include: {
          setLogs: true,
        },
      },
    },
  })

  res.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      programName: session.programNameSnapshot,
      dayName: session.dayNameSnapshot,
      badgeColor: session.badgeColorSnapshot,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSec: session.durationSec,
      exerciseCount: session.sessionExercises.length,
      setCount: session.sessionExercises.reduce(
        (total, sessionExercise) => total + sessionExercise.setLogs.length,
        0,
      ),
    })),
  })
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

  const previousPerformanceReferences = await getPreviousPerformanceReferences(
    userId,
    session.startedAt,
    session.sessionExercises.map((sessionExercise) => sessionExercise.exerciseId),
  )

  res.json({
    session: toSessionPayload(
      session,
      previousPerformanceReferences.lastTimeReferences,
      previousPerformanceReferences.previousWorkoutReferences,
    ),
  })
})

sessionsRouter.patch('/:sessionId/notes', requireAuth, async (req, res) => {
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

  const parsedBody = updateSessionNotesSchema.safeParse(req.body ?? {})

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const updated = await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId,
      endedAt: null,
    },
    data: { notes: parsedBody.data.notes },
  })

  if (updated.count === 0) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { endedAt: true },
    })

    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    res.status(409).json({ error: 'Finished workouts cannot be edited' })
    return
  }

  res.json({ notes: parsedBody.data.notes })
})

sessionsRouter.delete('/:sessionId', requireAuth, async (req, res) => {
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

  const deleted = await prisma.session.deleteMany({
    where: {
      id: sessionId,
      userId,
      endedAt: null,
    },
  })

  if (deleted.count > 0) {
    res.status(204).send()
    return
  }

  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: { endedAt: true },
  })

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  res.status(409).json({ error: 'Finished workouts cannot be cancelled' })
})

sessionsRouter.post('/:sessionId/exercises', requireAuth, async (req, res) => {
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

  const parsedBody = sessionExerciseSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  })

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.endedAt) {
    res.status(409).json({ error: 'Finished workouts cannot be edited' })
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

  const existingSessionExercise = await prisma.sessionExercise.findFirst({
    where: { sessionId, exerciseId: exercise.id },
  })

  if (existingSessionExercise) {
    res.status(409).json({ error: 'Exercise is already in this workout' })
    return
  }

  const latestSessionExercise = await prisma.sessionExercise.findFirst({
    where: { sessionId },
    orderBy: { order: 'desc' },
  })

  const sessionExercise = await prisma.sessionExercise.create({
    data: {
      sessionId,
      exerciseId: exercise.id,
      nameSnapshot: exercise.name,
      order: (latestSessionExercise?.order ?? 0) + 1,
    },
    include: {
      setLogs: {
        orderBy: { order: 'asc' },
      },
    },
  })

  res.status(201).json({ exercise: toSessionExercisePayload(sessionExercise) })
})

sessionsRouter.patch('/:sessionId/exercises/:sessionExerciseId', requireAuth, async (req, res) => {
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

  const parsedBody = sessionExerciseSchema.safeParse(req.body)

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
    include: {
      session: true,
      setLogs: {
        select: { id: true },
      },
    },
  })

  if (!sessionExercise) {
    res.status(404).json({ error: 'Session exercise not found' })
    return
  }

  if (sessionExercise.session.endedAt) {
    res.status(409).json({ error: 'Finished workouts cannot be edited' })
    return
  }

  if (sessionExercise.setLogs.length > 0) {
    res.status(409).json({ error: 'Exercises with logged sets cannot be swapped' })
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

  const existingSessionExercise = await prisma.sessionExercise.findFirst({
    where: {
      sessionId,
      exerciseId: exercise.id,
      id: { not: sessionExerciseId },
    },
  })

  if (existingSessionExercise) {
    res.status(409).json({ error: 'Exercise is already in this workout' })
    return
  }

  const updatedSessionExercise = await prisma.sessionExercise.update({
    where: { id: sessionExerciseId },
    data: {
      exerciseId: exercise.id,
      nameSnapshot: exercise.name,
    },
    include: {
      setLogs: {
        orderBy: { order: 'asc' },
      },
    },
  })

  res.json({ exercise: toSessionExercisePayload(updatedSessionExercise) })
})

sessionsRouter.delete('/:sessionId/exercises/:sessionExerciseId', requireAuth, async (req, res) => {
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

  const sessionExercise = await prisma.sessionExercise.findFirst({
    where: {
      id: sessionExerciseId,
      sessionId,
      session: { userId },
    },
    include: { session: true },
  })

  if (!sessionExercise) {
    res.status(404).json({ error: 'Session exercise not found' })
    return
  }

  if (sessionExercise.session.endedAt) {
    res.status(409).json({ error: 'Finished workouts cannot be edited' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.sessionExercise.delete({
      where: { id: sessionExerciseId },
    })

    const laterExercises = await tx.sessionExercise.findMany({
      where: {
        sessionId,
        order: { gt: sessionExercise.order },
      },
      orderBy: { order: 'asc' },
    })

    for (const [index, laterExercise] of laterExercises.entries()) {
      await tx.sessionExercise.update({
        where: { id: laterExercise.id },
        data: { order: sessionExercise.order + index },
      })
    }
  })

  res.status(204).send()
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
    include: { session: true },
  })

  if (!sessionExercise) {
    res.status(404).json({ error: 'Session exercise not found' })
    return
  }

  if (sessionExercise.session.endedAt) {
    res.status(409).json({ error: 'Finished workouts cannot be edited' })
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
      notes: parsedBody.data.notes || null,
      weightKg: parsedBody.data.weightKg,
      reps: parsedBody.data.reps,
      order: (latestSet?.order ?? 0) + 1,
    },
  })

  res.status(201).json({
    set: {
      id: setLog.id,
      kind: setLog.kind,
      parentSetId: setLog.parentSetId,
      notes: setLog.notes,
      weightKg: setLog.weightKg,
      reps: setLog.reps,
      order: setLog.order,
    },
  })
})

sessionsRouter.post('/:sessionId/exercises/:sessionExerciseId/sets/batch', requireAuth, async (req, res) => {
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

  const parsedBody = addSetChainSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const { parentSetId, sets } = parsedBody.data
  const expectedKind = parentSetId ? 'DROP' : undefined
  const hasValidKinds = parentSetId
    ? sets.every((set) => set.kind === expectedKind)
    : sets[0]?.kind === 'NORMAL' && sets.slice(1).every((set) => set.kind === 'DROP')

  if (!hasValidKinds) {
    res.status(400).json({ error: parentSetId ? 'Drop chains can only contain drop sets' : 'A chain must start with a normal set' })
    return
  }

  const sessionExercise = await prisma.sessionExercise.findFirst({
    where: {
      id: sessionExerciseId,
      sessionId,
      session: { userId },
    },
    include: { session: true },
  })

  if (!sessionExercise) {
    res.status(404).json({ error: 'Session exercise not found' })
    return
  }

  if (sessionExercise.session.endedAt) {
    res.status(409).json({ error: 'Finished workouts cannot be edited' })
    return
  }

  if (parentSetId) {
    const parentSet = await prisma.setLog.findFirst({
      where: {
        id: parentSetId,
        sessionExerciseId,
        kind: 'NORMAL',
        parentSetId: null,
      },
    })

    if (!parentSet) {
      res.status(404).json({ error: 'Parent normal set not found' })
      return
    }
  }

  const setLogs = await prisma.$transaction(async (tx) => {
    const latestSet = await tx.setLog.findFirst({
      where: { sessionExerciseId },
      orderBy: { order: 'desc' },
    })
    let nextOrder = (latestSet?.order ?? 0) + 1
    let rootSetId = parentSetId ?? null
    const createdSets = []

    for (const set of sets) {
      const setLog = await tx.setLog.create({
        data: {
          sessionExerciseId,
          parentSetId: rootSetId,
          kind: set.kind,
          notes: set.notes || null,
          weightKg: set.weightKg,
          reps: set.reps,
          order: nextOrder,
        },
      })
      createdSets.push(setLog)
      rootSetId ??= setLog.id
      nextOrder += 1
    }

    return createdSets
  })

  res.status(201).json({
    sets: setLogs.map((setLog) => ({
      id: setLog.id,
      kind: setLog.kind,
      parentSetId: setLog.parentSetId,
      notes: setLog.notes,
      weightKg: setLog.weightKg,
      reps: setLog.reps,
      order: setLog.order,
    })),
  })
})

sessionsRouter.patch('/:sessionId/exercises/:sessionExerciseId/sets/:setId', requireAuth, async (req, res) => {
  const userId = req.userId
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : null
  const sessionExerciseId = typeof req.params.sessionExerciseId === 'string' ? req.params.sessionExerciseId : null
  const setId = typeof req.params.setId === 'string' ? req.params.setId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!sessionId || !sessionExerciseId || !setId) {
    res.status(400).json({ error: 'Invalid session, exercise, or set id' })
    return
  }

  const parsedBody = updateSetSchema.safeParse(req.body)

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
    include: { session: true },
  })

  if (!sessionExercise) {
    res.status(404).json({ error: 'Session exercise not found' })
    return
  }

  if (sessionExercise.session.endedAt) {
    res.status(409).json({ error: 'Finished workouts cannot be edited' })
    return
  }

  const existingSet = await prisma.setLog.findFirst({
    where: {
      id: setId,
      sessionExerciseId,
    },
  })

  if (!existingSet) {
    res.status(404).json({ error: 'Set not found' })
    return
  }

  const updateData: {
    kind?: 'WARMUP' | 'NORMAL' | 'DROP'
    notes?: string | null
    weightKg?: number
    reps?: number
  } = {}
  if (parsedBody.data.kind) {
    updateData.kind = parsedBody.data.kind
  }
  if (parsedBody.data.notes !== undefined) {
    updateData.notes = parsedBody.data.notes || null
  }
  if (parsedBody.data.weightKg !== undefined) {
    updateData.weightKg = parsedBody.data.weightKg
  }
  if (parsedBody.data.reps !== undefined) {
    updateData.reps = parsedBody.data.reps
  }

  const setLog = await prisma.setLog.update({
    where: { id: setId },
    data: updateData,
  })

  res.json({
    set: {
      id: setLog.id,
      kind: setLog.kind,
      parentSetId: setLog.parentSetId,
      notes: setLog.notes,
      weightKg: setLog.weightKg,
      reps: setLog.reps,
      order: setLog.order,
    },
  })
})

sessionsRouter.delete('/:sessionId/exercises/:sessionExerciseId/sets/:setId', requireAuth, async (req, res) => {
  const userId = req.userId
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : null
  const sessionExerciseId = typeof req.params.sessionExerciseId === 'string' ? req.params.sessionExerciseId : null
  const setId = typeof req.params.setId === 'string' ? req.params.setId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!sessionId || !sessionExerciseId || !setId) {
    res.status(400).json({ error: 'Invalid session, exercise, or set id' })
    return
  }

  const sessionExercise = await prisma.sessionExercise.findFirst({
    where: {
      id: sessionExerciseId,
      sessionId,
      session: { userId },
    },
    include: { session: true },
  })

  if (!sessionExercise) {
    res.status(404).json({ error: 'Session exercise not found' })
    return
  }

  if (sessionExercise.session.endedAt) {
    res.status(409).json({ error: 'Finished workouts cannot be edited' })
    return
  }

  const existingSet = await prisma.setLog.findFirst({
    where: {
      id: setId,
      sessionExerciseId,
    },
  })

  if (!existingSet) {
    res.status(404).json({ error: 'Set not found' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.setLog.delete({
      where: { id: setId },
    })

    const remainingSets = await tx.setLog.findMany({
      where: {
        sessionExerciseId,
        order: { gt: existingSet.order },
      },
      orderBy: { order: 'asc' },
    })

    for (const [index, setLog] of remainingSets.entries()) {
      await tx.setLog.update({
        where: { id: setLog.id },
        data: { order: existingSet.order + index },
      })
    }
  })

  res.status(204).send()
})

sessionsRouter.patch('/:sessionId/finish', requireAuth, async (req, res) => {
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

  const parsedBody = finishSessionSchema.safeParse(req.body ?? {})

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  })

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.endedAt) {
    res.status(409).json({ error: 'Workout has already been finished' })
    return
  }

  const endedAt = new Date()
  const durationSec = Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000)

  const finished = await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId,
      endedAt: null,
    },
    data: {
      endedAt,
      durationSec,
      ...(parsedBody.data.notes !== undefined ? { notes: parsedBody.data.notes } : {}),
    },
  })

  if (finished.count === 0) {
    const currentSession = await prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { endedAt: true },
    })

    if (!currentSession) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    res.status(409).json({ error: 'Workout has already been finished' })
    return
  }

  const updatedSession = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
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

  const previousPerformanceReferences = await getPreviousPerformanceReferences(
    userId,
    updatedSession.startedAt,
    updatedSession.sessionExercises.map((sessionExercise) => sessionExercise.exerciseId),
  )

  res.json({
    session: toSessionPayload(
      updatedSession,
      previousPerformanceReferences.lastTimeReferences,
      previousPerformanceReferences.previousWorkoutReferences,
    ),
  })
})
