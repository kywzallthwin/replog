import { Router } from 'express'
import { estimateOneRepMaxKg, isBetterEstimatedSet } from '../../estimatedOneRepMax.js'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'

export const progressRouter = Router()

type ProgressExercise = {
  id: string
  name: string
  category: string
}

type ProgressSetLog = {
  weightKg: number
  reps: number
  sessionExercise: {
    exerciseId: string
    exercise: {
      id: string
      name: string
      category: {
        id: string
        displayName: string
      }
    }
    session: {
      id: string
      startedAt: Date
      workoutDate: Date | null
      dayNameSnapshot: string
    }
  }
}

type ProgressPersonalBest = {
  sessionId: string
  startedAt: Date
  workoutDate: Date | null
  estimatedOneRepMaxKg: number
  weightKg: number
  reps: number
}

type ProgressSessionHistoryEntry = {
  sessionId: string
  startedAt: Date
  workoutDate: Date | null
  dayName: string
  volumeKg: number
  topSet: {
    estimatedOneRepMaxKg: number
    weightKg: number
    reps: number
  }
}

export type ProgressExerciseSummary = {
  exercise: ProgressExercise
  personalBest: ProgressPersonalBest | null
  stats: {
    sessionCount: number
    progressKg: number
    heaviestWeightKg: number
  }
  sessionHistory: ProgressSessionHistoryEntry[]
  trendEstimatedOneRepMaxKg: number[]
}

export function buildExerciseProgressSummary(
  exercise: ProgressExercise,
  exerciseSetLogs: ProgressSetLog[],
): ProgressExerciseSummary {
  const sessionsById = new Map<
    string,
    {
      sessionId: string
      startedAt: Date
      workoutDate: Date | null
      dayName: string
      volumeKg: number
      topSet: { estimatedOneRepMaxKg: number; weightKg: number; reps: number }
    }
  >()

  for (const setLog of exerciseSetLogs) {
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
        workoutDate: session.workoutDate,
        dayName: session.dayNameSnapshot,
        volumeKg: setLog.weightKg * setLog.reps,
        topSet: candidateSet,
      })
      continue
    }

    sessionEntry.volumeKg += setLog.weightKg * setLog.reps

    if (isBetterEstimatedSet(candidateSet, sessionEntry.topSet)) {
      sessionEntry.topSet = candidateSet
    }
  }

  const sessionHistory = [...sessionsById.values()].sort(
    (a, b) => (b.workoutDate?.getTime() ?? b.startedAt.getTime()) - (a.workoutDate?.getTime() ?? a.startedAt.getTime()) || b.startedAt.getTime() - a.startedAt.getTime() || b.sessionId.localeCompare(a.sessionId),
  )
  const chronologicalHistory = [...sessionHistory].reverse()
  const personalBest = sessionHistory.reduce<ProgressPersonalBest | null>((best, session) => {
    const candidate = {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      workoutDate: session.workoutDate,
      estimatedOneRepMaxKg: session.topSet.estimatedOneRepMaxKg,
      weightKg: session.topSet.weightKg,
      reps: session.topSet.reps,
    }

    return isBetterEstimatedSet(candidate, best) ? candidate : best
  }, null)
  const earliestEstimatedOneRepMax = chronologicalHistory[0]?.topSet.estimatedOneRepMaxKg ?? 0
  const latestEstimatedOneRepMax = chronologicalHistory.at(-1)?.topSet.estimatedOneRepMaxKg ?? 0
  const heaviestWeightKg = exerciseSetLogs.reduce(
    (bestWeight, setLog) => Math.max(bestWeight, setLog.weightKg),
    0,
  )

  return {
    exercise,
    personalBest,
    stats: {
      sessionCount: sessionHistory.length,
      progressKg: latestEstimatedOneRepMax - earliestEstimatedOneRepMax,
      heaviestWeightKg,
    },
    sessionHistory: sessionHistory.map((session) => ({
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      workoutDate: session.workoutDate,
      dayName: session.dayName,
      volumeKg: session.volumeKg,
      topSet: session.topSet,
    })),
    trendEstimatedOneRepMaxKg: chronologicalHistory.map((session) => session.topSet.estimatedOneRepMaxKg),
  }
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
          exercise: { include: { category: true } },
          session: true,
        },
      },
    },
  })

  const workingSetLogs = setLogs.filter((setLog) => setLog.kind === 'NORMAL')
  const labels = new Map((await prisma.userCategoryLabel.findMany({ where: { userId }, select: { categoryId: true, displayName: true } })).map((label) => [label.categoryId, label.displayName]))
  const exerciseMap = new Map<string, ProgressExercise>()

  for (const setLog of workingSetLogs) {
    exerciseMap.set(setLog.sessionExercise.exerciseId, {
      id: setLog.sessionExercise.exerciseId,
      name: setLog.sessionExercise.exercise.name,
      category: labels.get(setLog.sessionExercise.exercise.category.id) ?? setLog.sessionExercise.exercise.category.displayName,
    })
  }

  const exercises = [...exerciseMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  const setLogsByExerciseId = new Map<string, ProgressSetLog[]>()

  for (const setLog of workingSetLogs) {
    const exerciseSetLogs = setLogsByExerciseId.get(setLog.sessionExercise.exerciseId)

    if (exerciseSetLogs) {
      exerciseSetLogs.push(setLog)
    } else {
      setLogsByExerciseId.set(setLog.sessionExercise.exerciseId, [setLog])
    }
  }

  const exerciseSummaries = exercises.map((exercise) =>
    buildExerciseProgressSummary(exercise, setLogsByExerciseId.get(exercise.id) ?? []),
  )

  if (requestedExerciseId && !exercises.some((exercise) => exercise.id === requestedExerciseId)) {
    res.status(404).json({ error: 'Exercise progress not found' })
    return
  }

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
      exerciseSummaries: [],
    })
    return
  }

  const selectedSummary =
    exerciseSummaries.find((summary) => summary.exercise.id === selectedExercise.id) ??
    buildExerciseProgressSummary(selectedExercise, [])

  res.json({
    exercises,
    selectedExercise,
    personalBest: selectedSummary.personalBest,
    stats: selectedSummary.stats,
    sessionHistory: selectedSummary.sessionHistory,
    trendEstimatedOneRepMaxKg: selectedSummary.trendEstimatedOneRepMaxKg,
    exerciseSummaries,
  })
})
