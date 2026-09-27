import { Router } from 'express'
import { prisma } from '../../prisma.js'
import { requireAuth } from '../auth/auth.middleware.js'
import { categoryNameSchema, createExerciseSchema } from './exercises.schemas.js'
import { hasCategoryNameConflict, loadCategoryLabels, normalizeCategoryName } from './categoryLabels.js'

export const exercisesRouter = Router()

function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function categoryName(category: { id: string; displayName: string; ownerId: string | null }, labels: Map<string, string>) {
  return category.ownerId === null ? labels.get(category.id) ?? category.displayName : category.displayName
}

function toExercisePayload(exercise: { id: string; name: string; ownerId: string | null; category: { id: string; displayName: string; ownerId: string | null } }, labels: Map<string, string>) {
  return {
    id: exercise.id,
    name: exercise.name,
    category: { id: exercise.category.id, name: categoryName(exercise.category, labels), isCustom: exercise.category.ownerId !== null },
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
    include: { category: true },
    orderBy: [{ name: 'asc' }],
  })
  const labels = await loadCategoryLabels(userId)

  res.json({
    exercises: exercises.map((exercise) => toExercisePayload(exercise, labels)),
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

  const category = await prisma.exerciseCategory.findFirst({ where: { id: parsedBody.data.categoryId, OR: [{ ownerId: null }, { ownerId: userId }] } })
  if (!category) { res.status(400).json({ error: 'Invalid category' }); return }
  const exercise = await prisma.exercise.create({
    data: {
      name: parsedBody.data.name,
      categoryId: category.id,
      ownerId: userId,
    },
  })

  const created = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id }, include: { category: true } })
  res.status(201).json({ exercise: toExercisePayload(created, await loadCategoryLabels(userId)) })
})

exercisesRouter.patch('/:exerciseId/category', requireAuth, async (req, res) => {
  const userId = req.userId
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return }
  const exerciseId = Array.isArray(req.params.exerciseId) ? req.params.exerciseId[0] : req.params.exerciseId
  const parsed = createExerciseSchema.shape.categoryId.safeParse(req.body?.categoryId)
  if (!exerciseId || !parsed.success) { res.status(400).json({ error: 'Invalid category' }); return }
  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, ownerId: userId } })
  if (!exercise) { res.status(404).json({ error: 'Exercise not found' }); return }
  const category = await prisma.exerciseCategory.findFirst({ where: { id: parsed.data, OR: [{ ownerId: null }, { ownerId: userId }] } })
  if (!category) { res.status(400).json({ error: 'Invalid category' }); return }
  const updated = await prisma.exercise.update({ where: { id: exercise.id }, data: { categoryId: category.id }, include: { category: true } })
  const labels = await loadCategoryLabels(userId)
  res.json({ exercise: toExercisePayload(updated, labels) })
})

exercisesRouter.get('/categories', requireAuth, async (req, res) => {
  const userId = req.userId
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return }
  const categories = await prisma.exerciseCategory.findMany({ where: { OR: [{ ownerId: null }, { ownerId: userId }] }, orderBy: [{ ownerId: 'asc' }, { displayOrder: 'asc' }, { displayName: 'asc' }] })
  const labels = await loadCategoryLabels(userId)
  res.json({ categories: categories.map((category) => ({ id: category.id, name: categoryName(category, labels), isCustom: category.ownerId !== null, isOverridden: labels.has(category.id) })) })
})

exercisesRouter.post('/categories', requireAuth, async (req, res) => {
  const userId = req.userId
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return }
  const parsed = categoryNameSchema.safeParse(req.body?.name)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid category name' }); return }
  const displayName = parsed.data.replace(/\s+/g, ' ')
  if (await hasCategoryNameConflict(userId, displayName)) { res.status(409).json({ error: 'A category with this name already exists' }); return }
  const category = await prisma.exerciseCategory.create({ data: { displayName, normalizedName: normalizeCategoryName(displayName), ownerId: userId, displayOrder: 1000 } })
  res.status(201).json({ category: { id: category.id, name: category.displayName, isCustom: true, isOverridden: false } })
})

exercisesRouter.patch('/categories/:categoryId', requireAuth, async (req, res) => {
  const userId = req.userId
  const parsed = categoryNameSchema.safeParse(req.body?.name)
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return }
  if (!parsed.success) { res.status(400).json({ error: 'Invalid category name' }); return }
  const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId
  if (!categoryId) { res.status(404).json({ error: 'Category not found' }); return }
  const category = await prisma.exerciseCategory.findFirst({ where: { id: categoryId, OR: [{ ownerId: userId }, { ownerId: null }] } })
  if (!category) { res.status(404).json({ error: 'Category not found' }); return }
  const displayName = parsed.data.replace(/\s+/g, ' ')
  const normalizedName = normalizeCategoryName(displayName)
  if (category.ownerId === null) {
    if (await hasCategoryNameConflict(userId, displayName, categoryId)) { res.status(409).json({ error: 'A category with this name already exists' }); return }
    const label = await prisma.userCategoryLabel.upsert({ where: { userId_categoryId: { userId, categoryId } }, create: { userId, categoryId, displayName, normalizedName }, update: { displayName, normalizedName } })
    res.json({ category: { id: category.id, name: label.displayName, isCustom: false, isOverridden: true } }); return
  }
  if (await hasCategoryNameConflict(userId, displayName, category.id)) { res.status(409).json({ error: 'A category with this name already exists' }); return }
  const updated = await prisma.exerciseCategory.update({ where: { id: category.id }, data: { displayName: parsed.data.replace(/\s+/g, ' '), normalizedName } })
  res.json({ category: { id: updated.id, name: updated.displayName, isCustom: true, isOverridden: false } })
})

exercisesRouter.delete('/categories/:categoryId/label', requireAuth, async (req, res) => {
  const userId = req.userId
  const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return }
  if (!categoryId) { res.status(404).json({ error: 'Built-in category not found' }); return }
  const category = await prisma.exerciseCategory.findFirst({ where: { id: categoryId, ownerId: null } })
  if (!category) { res.status(404).json({ error: 'Built-in category not found' }); return }
  const label = await prisma.userCategoryLabel.findUnique({ where: { userId_categoryId: { userId, categoryId } } })
  if (!label) { res.status(204).send(); return }
  if (await hasCategoryNameConflict(userId, category.displayName, categoryId)) {
    res.status(409).json({ error: 'A category with this name already exists' }); return
  }
  await prisma.userCategoryLabel.delete({ where: { userId_categoryId: { userId, categoryId } } })
  res.status(204).send()
})

exercisesRouter.delete('/categories/:categoryId', requireAuth, async (req, res) => {
  const userId = req.userId
  const replacementId = typeof req.query.replacementCategoryId === 'string' ? req.query.replacementCategoryId : null
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return }
  const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId
  if (!categoryId) { res.status(404).json({ error: 'Category not found' }); return }
  const category = await prisma.exerciseCategory.findFirst({ where: { id: categoryId, ownerId: userId } })
  if (!category) { res.status(404).json({ error: 'Category not found' }); return }
  const count = await prisma.exercise.count({ where: { categoryId: category.id } })
  if (count && !replacementId) { res.status(400).json({ error: 'A replacement category is required' }); return }
  if (replacementId) {
    if (replacementId === category.id) { res.status(400).json({ error: 'Replacement category must differ' }); return }
    const replacement = await prisma.exerciseCategory.findFirst({ where: { id: replacementId, OR: [{ ownerId: null }, { ownerId: userId }] } })
    if (!replacement) { res.status(400).json({ error: 'Invalid replacement category' }); return }
    await prisma.$transaction([prisma.exercise.updateMany({ where: { categoryId: category.id }, data: { categoryId: replacement.id } }), prisma.exerciseCategory.delete({ where: { id: category.id } })])
  } else await prisma.exerciseCategory.delete({ where: { id: category.id } })
  res.status(204).send()
})
