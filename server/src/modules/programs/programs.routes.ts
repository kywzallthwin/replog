import { Router } from 'express'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'
import { createStarterProgramForUser, createProgramFromDays, normalizeProgramName, programTemplates } from './starterProgram.js'
import {
  createDaySchema,
  createProgramSchema,
  dayExerciseSchema,
  reorderDayExerciseSchema,
  updateDaySchema,
  updateProgramSchema,
} from './programs.schemas.js'

export const programsRouter = Router()

const fullProgramInclude = {
  days: {
    orderBy: { order: 'asc' as const },
    include: {
      dayExercises: {
        orderBy: { order: 'asc' as const },
        include: { exercise: true },
      },
    },
  },
} as const

type FullProgram = {
  id: string
  name: string
  isActive: boolean
  days: Array<{
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
  }>
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function toDayExercisePayload(dayExercise: FullProgram['days'][number]['dayExercises'][number]) {
  return {
    id: dayExercise.id,
    exerciseId: dayExercise.exerciseId,
    name: dayExercise.exercise.name,
    category: dayExercise.exercise.category,
    order: dayExercise.order,
  }
}

function toDayPayload(day: FullProgram['days'][number]) {
  return {
    id: day.id,
    name: day.name,
    badgeColor: day.badgeColor,
    order: day.order,
    exercises: day.dayExercises.map(toDayExercisePayload),
  }
}

function toProgramPayload(program: FullProgram) {
  return {
    id: program.id,
    name: program.name,
    isActive: program.isActive,
    days: program.days.map(toDayPayload),
  }
}

function toProgramSummary(program: FullProgram) {
  return {
    id: program.id,
    name: program.name,
    isActive: program.isActive,
    dayCount: program.days.length,
    exerciseCount: program.days.reduce((count, day) => count + day.dayExercises.length, 0),
  }
}

async function getOwnedProgram(programId: string, userId: string) {
  return prisma.program.findFirst({
    where: programId === 'active'
      ? { ownerId: userId, isActive: true }
      : { id: programId, ownerId: userId },
  })
}

async function getFullOwnedProgram(programId: string, userId: string) {
  return prisma.program.findFirst({
    where: programId === 'active'
      ? { ownerId: userId, isActive: true }
      : { id: programId, ownerId: userId },
    include: fullProgramInclude,
  })
}

async function getFullProgramById(programId: string, userId: string) {
  return prisma.program.findFirst({
    where: { id: programId, ownerId: userId },
    include: fullProgramInclude,
  })
}

programsRouter.get('/templates', requireAuth, async (_req, res) => {
  res.json({
    templates: programTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      days: template.days.length,
      exerciseCount: template.days.reduce((count, day) => count + day.exercises.length, 0),
    })),
  })
})

programsRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  await createStarterProgramForUser(userId)
  const programs = await prisma.program.findMany({
    where: { ownerId: userId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    include: fullProgramInclude,
  })

  res.json({ programs: programs.map((program) => toProgramSummary(program as FullProgram)) })
})

programsRouter.get('/active', requireAuth, async (req, res) => {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  await createStarterProgramForUser(userId)
  const activeProgram = await getFullOwnedProgram('active', userId)

  res.json({ program: activeProgram ? toProgramPayload(activeProgram as FullProgram) : null })
})

programsRouter.get('/:programId', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId) {
    res.status(400).json({ error: 'Invalid program id' })
    return
  }

  const program = await getFullOwnedProgram(programId, userId)

  if (!program) {
    res.status(404).json({ error: 'Program not found' })
    return
  }

  res.json({ program: toProgramPayload(program as FullProgram) })
})

programsRouter.post('/', requireAuth, async (req, res) => {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const parsedBody = createProgramSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const { name, source, templateId, sourceProgramId } = parsedBody.data
  const copySourceProgramId = source === 'copy' ? sourceProgramId : undefined

  if (source === 'template' && !templateId) {
    res.status(400).json({ error: 'A template is required' })
    return
  }

  if (source === 'copy' && !sourceProgramId) {
    res.status(400).json({ error: 'A source program is required' })
    return
  }

  const sourceProgramForCopy = copySourceProgramId
    ? await prisma.program.findFirst({
        where: { id: copySourceProgramId, ownerId: userId },
        include: {
          days: {
            orderBy: { order: 'asc' },
            include: {
              dayExercises: { orderBy: { order: 'asc' } },
            },
          },
        },
      })
    : null

  if (source === 'copy' && !sourceProgramForCopy) {
    res.status(404).json({ error: 'Source program not found' })
    return
  }

  try {
    const createdProgram = await prisma.$transaction(async (tx) => {
      const db = tx as unknown as typeof prisma
      const programCount = await db.program.count({ where: { ownerId: userId } })
      const isActive = programCount === 0

      if (source === 'template') {
        const template = programTemplates.find((item) => item.id === templateId)

        if (!template) {
          throw new Error('TEMPLATE_NOT_FOUND')
        }

        return createProgramFromDays(db, userId, name, template.days, isActive)
      }

      if (source === 'copy') {
        if (!sourceProgramForCopy) {
          throw new Error('SOURCE_PROGRAM_NOT_FOUND')
        }

        return db.program.create({
          data: {
            ownerId: userId,
            name,
            nameKey: normalizeProgramName(name),
            isActive,
            activeKey: isActive ? 'active' : null,
            days: {
              create: sourceProgramForCopy.days.map((day) => ({
                name: day.name,
                badgeColor: day.badgeColor,
                order: day.order,
                dayExercises: {
                  create: day.dayExercises.map((exercise) => ({
                    exerciseId: exercise.exerciseId,
                    order: exercise.order,
                  })),
                },
              })),
            },
          },
        })
      }

      return db.program.create({
        data: {
          ownerId: userId,
          name,
          nameKey: normalizeProgramName(name),
          isActive,
          activeKey: isActive ? 'active' : null,
        },
      })
    })

    const program = await getFullProgramById(createdProgram.id, userId)
    res.status(201).json({ program: program ? toProgramPayload(program as FullProgram) : null })
  } catch (error) {
    if (error instanceof Error && error.message === 'TEMPLATE_NOT_FOUND') {
      res.status(404).json({ error: 'Program template not found' })
      return
    }

    if (error instanceof Error && error.message === 'SOURCE_PROGRAM_NOT_FOUND') {
      res.status(404).json({ error: 'Source program not found' })
      return
    }

    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A program with this name already exists' })
      return
    }

    throw error
  }
})

programsRouter.patch('/:programId', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId || programId === 'active') {
    res.status(400).json({ error: 'Invalid program id' })
    return
  }

  const parsedBody = updateProgramSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const ownedProgram = await getOwnedProgram(programId, userId)

  if (!ownedProgram) {
    res.status(404).json({ error: 'Program not found' })
    return
  }

  try {
    await prisma.program.update({
      where: { id: programId },
      data: {
        name: parsedBody.data.name,
        nameKey: normalizeProgramName(parsedBody.data.name),
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A program with this name already exists' })
      return
    }

    throw error
  }

  const program = await getFullProgramById(programId, userId)
  res.json({ program: program ? toProgramPayload(program as FullProgram) : null })
})

programsRouter.post('/:programId/activate', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId || programId === 'active') {
    res.status(400).json({ error: 'Invalid program id' })
    return
  }

  const activeSession = await prisma.session.findFirst({
    where: { userId, endedAt: null },
    select: { id: true },
  })

  if (activeSession) {
    res.status(409).json({
      error: 'Finish or cancel the active workout before switching programs',
      activeSessionId: activeSession.id,
    })
    return
  }

  const program = await getOwnedProgram(programId, userId)

  if (!program) {
    res.status(404).json({ error: 'Program not found' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.program.updateMany({ where: { ownerId: userId }, data: { isActive: false, activeKey: null } })
    await tx.program.update({ where: { id: programId }, data: { isActive: true, activeKey: 'active' } })
  })

  const activatedProgram = await getFullProgramById(programId, userId)
  res.json({ program: activatedProgram ? toProgramPayload(activatedProgram as FullProgram) : null })
})

programsRouter.delete('/:programId', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId || programId === 'active') {
    res.status(400).json({ error: 'Invalid program id' })
    return
  }

  const program = await getOwnedProgram(programId, userId)

  if (!program) {
    res.status(404).json({ error: 'Program not found' })
    return
  }

  if (program.isActive) {
    res.status(409).json({ error: 'The active program cannot be deleted. Activate another program first.' })
    return
  }

  const programCount = await prisma.program.count({ where: { ownerId: userId } })

  if (programCount <= 1) {
    res.status(409).json({ error: 'At least one program must remain' })
    return
  }

  await prisma.program.delete({ where: { id: programId } })
  res.status(204).send()
})

programsRouter.post('/:programId/days', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId) {
    res.status(400).json({ error: 'Invalid program id' })
    return
  }

  const parsedBody = createDaySchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const program = await getOwnedProgram(programId, userId)

  if (!program) {
    res.status(404).json({ error: 'Program not found' })
    return
  }

  const latestDay = await prisma.day.findFirst({ where: { programId: program.id }, orderBy: { order: 'desc' } })
  const day = await prisma.day.create({
    data: {
      programId: program.id,
      name: parsedBody.data.name,
      badgeColor: parsedBody.data.badgeColor,
      order: (latestDay?.order ?? 0) + 1,
    },
    include: { dayExercises: { orderBy: { order: 'asc' }, include: { exercise: true } } },
  })

  res.status(201).json({ day: toDayPayload(day as FullProgram['days'][number]) })
})

programsRouter.patch('/:programId/days/:dayId', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId || !dayId) {
    res.status(400).json({ error: 'Invalid program or day id' })
    return
  }

  const parsedBody = updateDaySchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const program = await getOwnedProgram(programId, userId)

  if (!program) {
    res.status(404).json({ error: 'Program not found' })
    return
  }

  const programIdForDays = program.id
  const day = await prisma.day.findFirst({ where: { id: dayId, programId: programIdForDays } })

  if (!day) {
    res.status(404).json({ error: 'Day not found' })
    return
  }

  const updatedDay = await prisma.day.update({
    where: { id: dayId },
    data: {
      ...(parsedBody.data.name !== undefined ? { name: parsedBody.data.name } : {}),
      ...(parsedBody.data.badgeColor !== undefined ? { badgeColor: parsedBody.data.badgeColor } : {}),
    },
    include: { dayExercises: { orderBy: { order: 'asc' }, include: { exercise: true } } },
  })

  res.json({ day: toDayPayload(updatedDay as FullProgram['days'][number]) })
})

programsRouter.delete('/:programId/days/:dayId', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId || !dayId) {
    res.status(400).json({ error: 'Invalid program or day id' })
    return
  }

  const program = await getOwnedProgram(programId, userId)

  if (!program) {
    res.status(404).json({ error: 'Program not found' })
    return
  }

  const programIdForDays = program.id
  const day = await prisma.day.findFirst({ where: { id: dayId, programId: programIdForDays } })

  if (!day) {
    res.status(404).json({ error: 'Day not found' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.day.delete({ where: { id: dayId } })
    const laterDays = await tx.day.findMany({
      where: { programId: programIdForDays, order: { gt: day.order } },
      orderBy: { order: 'asc' },
    })

    for (const [index, laterDay] of laterDays.entries()) {
      await tx.day.update({ where: { id: laterDay.id }, data: { order: day.order + index } })
    }
  })

  res.status(204).send()
})

programsRouter.post('/:programId/days/:dayId/exercises', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId || !dayId) {
    res.status(400).json({ error: 'Invalid program or day id' })
    return
  }

  const parsedBody = dayExerciseSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const program = await getOwnedProgram(programId, userId)
  const day = program ? await prisma.day.findFirst({ where: { id: dayId, programId: program.id } }) : null

  if (!day) {
    res.status(404).json({ error: 'Day not found' })
    return
  }

  const exercise = await prisma.exercise.findFirst({
    where: { id: parsedBody.data.exerciseId, OR: [{ ownerId: null }, { ownerId: userId }] },
  })

  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' })
    return
  }

  const existingDayExercise = await prisma.dayExercise.findFirst({ where: { dayId, exerciseId: exercise.id } })

  if (existingDayExercise) {
    res.status(409).json({ error: 'Exercise is already in this program day' })
    return
  }

  const latestDayExercise = await prisma.dayExercise.findFirst({ where: { dayId }, orderBy: { order: 'desc' } })
  const dayExercise = await prisma.dayExercise.create({
    data: { dayId, exerciseId: exercise.id, order: (latestDayExercise?.order ?? 0) + 1 },
    include: { exercise: true },
  })

  res.status(201).json({ exercise: toDayExercisePayload({ ...dayExercise, exercise: dayExercise.exercise }) })
})

programsRouter.delete('/:programId/days/:dayId/exercises/:dayExerciseId', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null
  const dayExerciseId = typeof req.params.dayExerciseId === 'string' ? req.params.dayExerciseId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId || !dayId || !dayExerciseId) {
    res.status(400).json({ error: 'Invalid program, day, or exercise id' })
    return
  }

  const program = await getOwnedProgram(programId, userId)
  const dayExercise = program
    ? await prisma.dayExercise.findFirst({ where: { id: dayExerciseId, dayId, day: { programId: program.id } } })
    : null

  if (!dayExercise) {
    res.status(404).json({ error: 'Day exercise not found' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.dayExercise.delete({ where: { id: dayExerciseId } })
    const laterExercises = await tx.dayExercise.findMany({
      where: { dayId, order: { gt: dayExercise.order } },
      orderBy: { order: 'asc' },
    })

    for (const [index, laterExercise] of laterExercises.entries()) {
      await tx.dayExercise.update({ where: { id: laterExercise.id }, data: { order: dayExercise.order + index } })
    }
  })

  res.status(204).send()
})

programsRouter.patch('/:programId/days/:dayId/exercises/:dayExerciseId/reorder', requireAuth, async (req, res) => {
  const userId = req.userId
  const programId = typeof req.params.programId === 'string' ? req.params.programId : null
  const dayId = typeof req.params.dayId === 'string' ? req.params.dayId : null
  const dayExerciseId = typeof req.params.dayExerciseId === 'string' ? req.params.dayExerciseId : null

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!programId || !dayId || !dayExerciseId) {
    res.status(400).json({ error: 'Invalid program, day, or exercise id' })
    return
  }

  const parsedBody = reorderDayExerciseSchema.safeParse(req.body)

  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid request body', fields: parsedBody.error.flatten().fieldErrors })
    return
  }

  const program = await getOwnedProgram(programId, userId)
  const target = program
    ? await prisma.dayExercise.findFirst({ where: { id: dayExerciseId, dayId, day: { programId: program.id } } })
    : null

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

  if (sourceIndex < 0 || targetIndex >= exercisesInDay.length) {
    res.status(400).json({ error: 'Invalid target exercise position' })
    return
  }

  const reordered = [...exercisesInDay]

  if (sourceIndex !== targetIndex) {
    const [movedExercise] = reordered.splice(sourceIndex, 1)

    if (!movedExercise) {
      res.status(400).json({ error: 'Invalid target exercise position' })
      return
    }

    reordered.splice(targetIndex, 0, movedExercise)
    await prisma.$transaction(async (tx) => {
      for (const [index, exercise] of reordered.entries()) {
        await tx.dayExercise.update({ where: { id: exercise.id }, data: { order: -(index + 1) } })
      }

      for (const [index, exercise] of reordered.entries()) {
        await tx.dayExercise.update({ where: { id: exercise.id }, data: { order: index + 1 } })
      }
    })
  }

  res.json({
    exercises: reordered.map((exercise, index) => toDayExercisePayload({ ...exercise, order: index + 1 })),
  })
})
