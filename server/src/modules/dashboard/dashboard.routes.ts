import { Router } from 'express'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'
import { createStarterProgramForUser } from '../programs/starterProgram.js'

export const dashboardRouter = Router()

function formatCategory(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

dashboardRouter.get('/', requireAuth, async (req, res) => {
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

  const [activeSession, recentSessions, workoutCount, latestSession, setLogs] = await Promise.all([
    prisma.session.findFirst({
      where: { userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
      include: {
        sessionExercises: true,
      },
    }),
    prisma.session.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: 3,
      include: {
        sessionExercises: true,
      },
    }),
    prisma.session.count({
      where: { userId, endedAt: { not: null } },
    }),
    prisma.session.findFirst({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      include: { day: true },
    }),
    prisma.setLog.findMany({
      where: {
        sessionExercise: {
          session: { userId, endedAt: { not: null } },
        },
      },
      select: {
        reps: true,
        weightKg: true,
      },
    }),
  ])
  const totalVolumeKg = setLogs.reduce((total, set) => total + set.weightKg * set.reps, 0)
  const days = activeProgram?.days ?? []
  const latestSessionDay = latestSession?.day
  const latestDayOrder =
    latestSessionDay && latestSessionDay.programId === activeProgram?.id ? latestSessionDay.order : null
  const suggestedDay =
    days.find((day) => day.order === (latestDayOrder ?? 0) + 1) ?? days[0] ?? null

  res.json({
    activeSession: activeSession
      ? {
          id: activeSession.id,
          dayName: activeSession.dayNameSnapshot,
          badgeColor: activeSession.badgeColorSnapshot,
          startedAt: activeSession.startedAt,
          endedAt: activeSession.endedAt,
          durationSec: activeSession.durationSec,
          exerciseCount: activeSession.sessionExercises.length,
        }
      : null,
    activeProgram: activeProgram
      ? {
          id: activeProgram.id,
          name: activeProgram.name,
          days: days.map((day) => {
            const categories = new Set(
              day.dayExercises.map((dayExercise) => formatCategory(dayExercise.exercise.category)),
            )

            return {
              id: day.id,
              name: day.name,
              badgeColor: day.badgeColor,
              order: day.order,
              exerciseCount: day.dayExercises.length,
              categories: [...categories],
            }
          }),
        }
      : null,
    suggestedDay: suggestedDay
      ? {
          id: suggestedDay.id,
          name: suggestedDay.name,
          badgeColor: suggestedDay.badgeColor,
          exerciseCount: suggestedDay.dayExercises.length,
          categories: [...new Set(suggestedDay.dayExercises.map((dayExercise) => formatCategory(dayExercise.exercise.category)))],
        }
      : null,
    recentSessions: recentSessions.map((session) => ({
      id: session.id,
      dayName: session.dayNameSnapshot,
      badgeColor: session.badgeColorSnapshot,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSec: session.durationSec,
      exerciseCount: session.sessionExercises.length,
    })),
    stats: {
      workoutCount,
      setCount: setLogs.length,
      totalVolumeKg,
    },
  })
})
