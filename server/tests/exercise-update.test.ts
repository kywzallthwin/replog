/// <reference types="node" />
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'

const { app } = await import('../src/index.js')
const { prisma } = await import('../src/prisma.js')

after(async () => {
  await prisma.$disconnect()
})

test('renames an owned custom exercise while preserving logged workout names', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ownerAgent = request.agent(app)

  try {
    const registerResponse = await ownerAgent.post('/api/auth/register').send({ email: `rename-owner-${suffix}@example.com`, username: 'Rename Owner', password: 'password123' })
    assert.equal(registerResponse.status, 201, registerResponse.text)
    const ownerId = registerResponse.body.user.id as string

    const category = await prisma.exerciseCategory.create({ data: { displayName: `Rename Category ${suffix}`, normalizedName: `rename-category-${suffix}`, ownerId, displayOrder: 1000 } })
    const globalCategory = await prisma.exerciseCategory.create({ data: { displayName: `Global Category ${suffix}`, normalizedName: `global-category-${suffix}`, displayOrder: 900 } })
    const globalExercise = await prisma.exercise.create({ data: { name: `Bench Press ${suffix}`, categoryId: globalCategory.id } })
    const exercise = await prisma.exercise.create({ data: { name: `Chest flat bench press ${suffix}`, categoryId: category.id, ownerId } })

    const session = await prisma.session.create({
      data: {
        userId: ownerId,
        dayNameSnapshot: 'Rename day',
        badgeColorSnapshot: 'bg-blue-100 text-blue-800',
        endedAt: new Date('2026-01-04T10:00:00.000Z'),
        sessionExercises: { create: [{ exerciseId: exercise.id, nameSnapshot: exercise.name, order: 1 }] },
      },
      include: { sessionExercises: true },
    })

    const response = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({ name: `Flat Bench Press ${suffix}` })
    assert.equal(response.status, 200, response.text)
    assert.equal(response.body.exercise.id, exercise.id)
    assert.equal(response.body.exercise.name, `Flat Bench Press ${suffix}`)
    assert.equal(response.body.exercise.isCustom, true)
    assert.equal(response.body.exercise.category.id, category.id)

    const renamed = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } })
    assert.equal(renamed.name, `Flat Bench Press ${suffix}`)

    const logged = await prisma.sessionExercise.findMany({ where: { sessionId: session.id } })
    assert.deepEqual(logged.map((entry) => entry.nameSnapshot), [`Chest flat bench press ${suffix}`])

    const history = await ownerAgent.get(`/api/sessions/${session.id}`)
    assert.equal(history.status, 200, history.text)
    const historyBody = history.body as { session: { exercises: { name: string }[] } }
    assert.deepEqual(historyBody.session.exercises.map((entry) => entry.name), [`Chest flat bench press ${suffix}`])

    const catalog = await ownerAgent.get('/api/exercises')
    assert.equal(catalog.status, 200, catalog.text)
    const catalogBody = catalog.body as { exercises: { id: string; name: string }[] }
    assert.ok(catalogBody.exercises.some((entry) => entry.id === exercise.id && entry.name === `Flat Bench Press ${suffix}`))
    assert.ok(catalogBody.exercises.some((entry) => entry.id === globalExercise.id))
  } finally {
    // Test data is isolated by unique names and is removed by the test database lifecycle.
  }
})

test('rejects unauthorized, duplicate, and invalid exercise updates', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ownerAgent = request.agent(app)
  const otherAgent = request.agent(app)

  try {
    const ownerResponse = await ownerAgent.post('/api/auth/register').send({ email: `rename-rules-owner-${suffix}@example.com`, username: 'Rename Rules Owner', password: 'password123' })
    const otherResponse = await otherAgent.post('/api/auth/register').send({ email: `rename-rules-other-${suffix}@example.com`, username: 'Rename Rules Other', password: 'password123' })
    assert.equal(ownerResponse.status, 201, ownerResponse.text)
    assert.equal(otherResponse.status, 201, otherResponse.text)
    const ownerId = ownerResponse.body.user.id as string
    const otherId = otherResponse.body.user.id as string

    const category = await prisma.exerciseCategory.create({ data: { displayName: `Rules Category ${suffix}`, normalizedName: `rules-category-${suffix}`, ownerId, displayOrder: 1000 } })
    const otherCategory = await prisma.exerciseCategory.create({ data: { displayName: `Rules Other Category ${suffix}`, normalizedName: `rules-other-category-${suffix}`, ownerId, displayOrder: 1000 } })
    const globalCategory = await prisma.exerciseCategory.create({ data: { displayName: `Rules Global Category ${suffix}`, normalizedName: `rules-global-category-${suffix}`, displayOrder: 901 } })
    const globalExercise = await prisma.exercise.create({ data: { name: `Global Lift ${suffix}`, categoryId: globalCategory.id } })
    const exercise = await prisma.exercise.create({ data: { name: `Owned Lift ${suffix}`, categoryId: category.id, ownerId } })
    const sibling = await prisma.exercise.create({ data: { name: `Sibling Lift ${suffix}`, categoryId: category.id, ownerId } })
    const otherExercise = await prisma.exercise.create({ data: { name: `Other Lift ${suffix}`, categoryId: category.id, ownerId: otherId } })

    const duplicateGlobal = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({ name: `  global lift ${suffix}  ` })
    assert.equal(duplicateGlobal.status, 409, duplicateGlobal.text)
    assert.equal(duplicateGlobal.body.error, 'An exercise with this name already exists')

    const duplicateSibling = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({ name: `sibling lift ${suffix}` })
    assert.equal(duplicateSibling.status, 409, duplicateSibling.text)

    const selfRename = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({ name: `owned lift ${suffix}` })
    assert.equal(selfRename.status, 200, selfRename.text)
    assert.equal(selfRename.body.exercise.name, `owned lift ${suffix}`)

    const otherUsersExercise = await ownerAgent.patch(`/api/exercises/${otherExercise.id}`).send({ name: `Hijacked ${suffix}` })
    assert.equal(otherUsersExercise.status, 404, otherUsersExercise.text)
    assert.equal((await prisma.exercise.findUniqueOrThrow({ where: { id: otherExercise.id } })).name, `Other Lift ${suffix}`)

    const globalExerciseUpdate = await ownerAgent.patch(`/api/exercises/${globalExercise.id}`).send({ name: `Hijacked Global ${suffix}` })
    assert.equal(globalExerciseUpdate.status, 404, globalExerciseUpdate.text)
    assert.equal((await prisma.exercise.findUniqueOrThrow({ where: { id: globalExercise.id } })).name, `Global Lift ${suffix}`)

    const emptyName = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({ name: '   ' })
    assert.equal(emptyName.status, 400, emptyName.text)

    const longName = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({ name: 'a'.repeat(81) })
    assert.equal(longName.status, 400, longName.text)

    const emptyBody = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({})
    assert.equal(emptyBody.status, 400, emptyBody.text)

    const unknownCategory = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({ categoryId: 'category-does-not-exist' })
    assert.equal(unknownCategory.status, 400, unknownCategory.text)
    assert.equal(unknownCategory.body.error, 'Invalid category')

    const categoryOnly = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({ categoryId: otherCategory.id })
    assert.equal(categoryOnly.status, 200, categoryOnly.text)
    assert.equal(categoryOnly.body.exercise.name, `owned lift ${suffix}`)
    assert.equal(categoryOnly.body.exercise.category.id, otherCategory.id)

    const nameAndCategory = await ownerAgent.patch(`/api/exercises/${exercise.id}`).send({ name: `Renamed Lift ${suffix}`, categoryId: category.id })
    assert.equal(nameAndCategory.status, 200, nameAndCategory.text)
    assert.equal(nameAndCategory.body.exercise.name, `Renamed Lift ${suffix}`)
    assert.equal(nameAndCategory.body.exercise.category.id, category.id)

    const stored = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } })
    assert.equal(stored.name, `Renamed Lift ${suffix}`)
    assert.equal(stored.categoryId, category.id)
    assert.equal(stored.ownerId, ownerId)
    assert.equal((await prisma.exercise.findUniqueOrThrow({ where: { id: sibling.id } })).name, `Sibling Lift ${suffix}`)
  } finally {
    // Test data is isolated by unique names and is removed by the test database lifecycle.
  }
})
