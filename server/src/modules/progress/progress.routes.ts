import { Router } from 'express'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'

export const progressRouter = Router()

function formatCategory(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

function estimateOneRepMaxKg(set: { weightKg: number; reps: number }) {
  if (set.reps === 1) {
    return set.weightKg
  }

  return set.weightKg * (1 + set.reps / 30)
}

function isBetterEstimatedSet(
  candidate: { estimatedOneRepMaxKg: number; weightKg: number; reps: number },
  current: { estimatedOneRepMaxKg: number; weightKg: number; reps: number } | null,
) {
  if (!current) {
    return true
  }

  if (candidate.estimatedOneRepMaxKg !== current.estimatedOneRepMaxKg) {
    return candidate.estimatedOneRepMaxKg > current.estimatedOneRepMaxKg
  }

  if (candidate.weightKg !== current.weightKg) {
    return candidate.weightKg > current.weightKg
  }

  return candidate.reps > current.reps
}

progressRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.userId
  const requestedExerciseId = typeof req.query.exerciseId === 'string' ? req.query.exerciseId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const setLogs = await prisma.setLog.findMany({
    where: {
      sessionExercise: {
        session: {
          userId,
          endedAt: { not: null },
        },
      },
    },
    include: {
      sessionExercise: {
        include: {
          exercise: true,
          session: true,
        },
      },
    },
  })

  const workingSetLogs = setLogs.filter((setLog) => setLog.kind === 'NORMAL')
  const exerciseMap = new Map<string, { id: string; name: string; category: string }>()

  for (const setLog of workingSetLogs) {
    exerciseMap.set(setLog.sessionExercise.exerciseId, {
      id: setLog.sessionExercise.exerciseId,
      name: setLog.sessionExercise.exercise.name,
      category: formatCategory(setLog.sessionExercise.exercise.category),
    })
  }

  const exercises = [...exerciseMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  const selectedExercise =
    exercises.find((exercise) => exercise.id === requestedExerciseId) ?? exercises[0] ?? null

  if (!selectedExercise) {
    res.json({
      exercises,
      selectedExercise: null,
      personalBest: null,
      stats: {
        sessionCount: 0,
        progressKg: 0,
        heaviestWeightKg: 0,
      },
      sessionHistory: [],
      trendEstimatedOneRepMaxKg: [],
    })
    return
  }

  const selectedSetLogs = workingSetLogs.filter(
    (setLog) => setLog.sessionExercise.exerciseId === selectedExercise.id,
  )
  const sessionsById = new Map<
    string,
    {
      sessionId: string
      startedAt: Date
      dayName: string
      topSet: { estimatedOneRepMaxKg: number; weightKg: number; reps: number }
    }
  >()

  for (const setLog of selectedSetLogs) {
    const session = setLog.sessionExercise.session
    const sessionEntry = sessionsById.get(session.id)
    const candidateSet = {
      estimatedOneRepMaxKg: estimateOneRepMaxKg(setLog),
      weightKg: setLog.weightKg,
      reps: setLog.reps,
    }

    if (!sessionEntry) {
      sessionsById.set(session.id, {
        sessionId: session.id,
        startedAt: session.startedAt,
        dayName: session.dayNameSnapshot,
        topSet: candidateSet,
      })
      continue
    }

    if (isBetterEstimatedSet(candidateSet, sessionEntry.topSet)) {
      sessionEntry.topSet = candidateSet
    }
  }

  const sessionHistory = [...sessionsById.values()].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  )
  const chronologicalHistory = [...sessionHistory].reverse()
  const personalBest = sessionHistory.reduce<{
    sessionId: string
    startedAt: Date
    estimatedOneRepMaxKg: number
    weightKg: number
    reps: number
  } | null>((best, session) => {
    const candidate = {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      estimatedOneRepMaxKg: session.topSet.estimatedOneRepMaxKg,
      weightKg: session.topSet.weightKg,
      reps: session.topSet.reps,
    }

    return isBetterEstimatedSet(candidate, best) ? candidate : best
  }, null)
  const earliestEstimatedOneRepMax = chronologicalHistory[0]?.topSet.estimatedOneRepMaxKg ?? 0
  const latestEstimatedOneRepMax = chronologicalHistory.at(-1)?.topSet.estimatedOneRepMaxKg ?? 0
  const heaviestWeightKg = selectedSetLogs.reduce(
    (bestWeight, setLog) => Math.max(bestWeight, setLog.weightKg),
    0,
  )

  res.json({
    exercises,
    selectedExercise,
    personalBest,
    stats: {
      sessionCount: sessionHistory.length,
      progressKg: latestEstimatedOneRepMax - earliestEstimatedOneRepMax,
      heaviestWeightKg,
    },
    sessionHistory: sessionHistory.map((session) => ({
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      dayName: session.dayName,
      topSet: session.topSet,
    })),
    trendEstimatedOneRepMaxKg: chronologicalHistory.map((session) => session.topSet.estimatedOneRepMaxKg),
  })
})
