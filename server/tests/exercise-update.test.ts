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

test('archives an owned custom exercise, removes it from program days with order recompaction, and preserves completed workout history and progress', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ownerAgent = request.agent(app)
  const otherAgent = request.agent(app)

  try {
    const ownerResponse = await ownerAgent.post('/api/auth/register').send({ email: `archive-owner-${suffix}@example.com`, username: 'Archive Owner', password: 'password123' })
    const otherResponse = await otherAgent.post('/api/auth/register').send({ email: `archive-other-${suffix}@example.com`, username: 'Archive Other', password: 'password123' })
    assert.equal(ownerResponse.status, 201, ownerResponse.text)
    assert.equal(otherResponse.status, 201, otherResponse.text)
    const ownerId = ownerResponse.body.user.id as string
    const otherId = otherResponse.body.user.id as string

    const category = await prisma.exerciseCategory.create({ data: { displayName: `Archive Category ${suffix}`, normalizedName: `archive-category-${suffix}`, ownerId, displayOrder: 1000 } })
    const globalCategory = await prisma.exerciseCategory.create({ data: { displayName: `Archive Global Category ${suffix}`, normalizedName: `archive-global-category-${suffix}`, displayOrder: 902 } })
    const globalExercise = await prisma.exercise.create({ data: { name: `Global Press ${suffix}`, categoryId: globalCategory.id } })
    const archivedExercise = await prisma.exercise.create({ data: { name: `Cable Fly ${suffix}`, categoryId: category.id, ownerId } })
    const siblingExercise = await prisma.exercise.create({ data: { name: `Pec Deck ${suffix}`, categoryId: category.id, ownerId } })
    const otherExercise = await prisma.exercise.create({ data: { name: `Other Custom ${suffix}`, categoryId: globalCategory.id, ownerId: otherId } })

    const programOne = await prisma.program.create({
      data: {
        ownerId,
        name: `Archive Program 1 ${suffix}`,
        nameKey: `archive-program-1-${suffix}`,
        days: {
          create: [
            {
              name: 'Day A',
              badgeColor: 'bg-blue-100 text-blue-800',
              order: 1,
              dayExercises: {
                create: [
                  { exerciseId: globalExercise.id, order: 1 },
                  { exerciseId: archivedExercise.id, order: 2 },
                  { exerciseId: siblingExercise.id, order: 3 },
                ],
              },
            },
            {
              name: 'Day B',
              badgeColor: 'bg-green-100 text-green-800',
              order: 2,
              dayExercises: {
                create: [
                  { exerciseId: archivedExercise.id, order: 1 },
                  { exerciseId: siblingExercise.id, order: 2 },
                ],
              },
            },
          ],
        },
      },
      include: { days: { orderBy: { order: 'asc' } } },
    })

    const programTwo = await prisma.program.create({
      data: {
        ownerId,
        name: `Archive Program 2 ${suffix}`,
        nameKey: `archive-program-2-${suffix}`,
        days: {
          create: [
            {
              name: 'Solo Day',
              badgeColor: 'bg-amber-100 text-amber-800',
              order: 1,
              dayExercises: {
                create: [{ exerciseId: archivedExercise.id, order: 1 }],
              },
            },
          ],
        },
      },
      include: { days: true },
    })

    const dayA = programOne.days[0]
    const dayB = programOne.days[1]
    const soloDay = programTwo.days[0]
    assert.ok(dayA && dayB && soloDay)

    const completedSession = await prisma.session.create({
      data: {
        userId: ownerId,
        programId: programOne.id,
        dayId: dayA.id,
        dayNameSnapshot: 'Day A',
        badgeColorSnapshot: 'bg-blue-100 text-blue-800',
        startedAt: new Date('2026-01-05T09:00:00.000Z'),
        endedAt: new Date('2026-01-05T10:00:00.000Z'),
        durationSec: 3600,
        sessionExercises: {
          create: [
            {
              exerciseId: archivedExercise.id,
              nameSnapshot: `Cable Fly Logged ${suffix}`,
              order: 1,
              setLogs: {
                create: [{ kind: 'NORMAL', weightKg: 45, reps: 10, order: 1 }],
              },
            },
          ],
        },
      },
    })

    const activeSession = await prisma.session.create({
      data: {
        userId: ownerId,
        programId: programOne.id,
        dayId: dayA.id,
        dayNameSnapshot: 'Day A',
        badgeColorSnapshot: 'bg-blue-100 text-blue-800',
        sessionExercises: {
          create: [
            { exerciseId: globalExercise.id, nameSnapshot: globalExercise.name, order: 1 },
          ],
        },
      },
    })
    const activeSessionExercise = await prisma.sessionExercise.findFirstOrThrow({
      where: { sessionId: activeSession.id },
    })

    // Built-in and other user's exercises cannot be deleted
    const deleteBuiltIn = await ownerAgent.delete(`/api/exercises/${globalExercise.id}`)
    assert.equal(deleteBuiltIn.status, 404, deleteBuiltIn.text)
    assert.equal((await prisma.exercise.findUniqueOrThrow({ where: { id: globalExercise.id } })).archivedAt, null)

    const deleteOther = await ownerAgent.delete(`/api/exercises/${otherExercise.id}`)
    assert.equal(deleteOther.status, 404, deleteOther.text)
    assert.equal((await prisma.exercise.findUniqueOrThrow({ where: { id: otherExercise.id } })).archivedAt, null)

    // Delete owned custom exercise
    const deleteResponse = await ownerAgent.delete(`/api/exercises/${archivedExercise.id}`)
    assert.equal(deleteResponse.status, 204, deleteResponse.text)

    const archivedRecord = await prisma.exercise.findUniqueOrThrow({ where: { id: archivedExercise.id } })
    assert.notEqual(archivedRecord.archivedAt, null)

    // Re-deleting an already-archived exercise returns 404
    const secondDelete = await ownerAgent.delete(`/api/exercises/${archivedExercise.id}`)
    assert.equal(secondDelete.status, 404, secondDelete.text)

    // Program days have removed the archived exercise and recompacted order
    const dayOneExercises = await prisma.dayExercise.findMany({
      where: { dayId: dayA.id },
      orderBy: { order: 'asc' },
    })
    assert.deepEqual(
      dayOneExercises.map((entry) => [entry.exerciseId, entry.order]),
      [
        [globalExercise.id, 1],
        [siblingExercise.id, 2],
      ],
    )

    const dayTwoExercises = await prisma.dayExercise.findMany({
      where: { dayId: dayB.id },
      orderBy: { order: 'asc' },
    })
    assert.deepEqual(
      dayTwoExercises.map((entry) => [entry.exerciseId, entry.order]),
      [[siblingExercise.id, 1]],
    )

    const soloDayExercises = await prisma.dayExercise.findMany({
      where: { dayId: soloDay.id },
    })
    assert.equal(soloDayExercises.length, 0)

    // Catalog excludes the archived exercise
    const catalogResponse = await ownerAgent.get('/api/exercises')
    assert.equal(catalogResponse.status, 200, catalogResponse.text)
    const catalogExercises = (catalogResponse.body as { exercises: { id: string }[] }).exercises
    assert.equal(catalogExercises.some((entry) => entry.id === archivedExercise.id), false)
    assert.equal(catalogExercises.some((entry) => entry.id === siblingExercise.id), true)
    assert.equal(catalogExercises.some((entry) => entry.id === globalExercise.id), true)

    // Completed workout history and progress remain intact
    const sessionDetail = await ownerAgent.get(`/api/sessions/${completedSession.id}`)
    assert.equal(sessionDetail.status, 200, sessionDetail.text)
    assert.deepEqual(
      (sessionDetail.body as { session: { exercises: { exerciseId: string; name: string; sets: { weightKg: number; reps: number }[] }[] } }).session.exercises.map((entry) => ({
        exerciseId: entry.exerciseId,
        name: entry.name,
        setCount: entry.sets.length,
      })),
      [{ exerciseId: archivedExercise.id, name: `Cable Fly Logged ${suffix}`, setCount: 1 }],
    )

    const historyResponse = await ownerAgent.get('/api/sessions/history')
    assert.equal(historyResponse.status, 200, historyResponse.text)
    const historySession = (historyResponse.body as { sessions: { id: string; exercisePreview: string[] }[] }).sessions.find((item) => item.id === completedSession.id)
    assert.deepEqual(historySession?.exercisePreview, [`Cable Fly Logged ${suffix}`])

    const progressResponse = await ownerAgent.get(`/api/progress?exerciseId=${archivedExercise.id}`)
    assert.equal(progressResponse.status, 200, progressResponse.text)
    assert.equal(progressResponse.body.selectedExercise.id, archivedExercise.id)
    assert.equal(progressResponse.body.stats.sessionCount, 1)
    assert.equal(progressResponse.body.stats.heaviestWeightKg, 45)

    // Archived exercise is excluded from active normalized-name uniqueness checks on update and create
    const renameToArchivedName = await ownerAgent.patch(`/api/exercises/${siblingExercise.id}`).send({ name: `  cable fly ${suffix}  ` })
    assert.equal(renameToArchivedName.status, 200, renameToArchivedName.text)

    const restoreSiblingName = await ownerAgent.patch(`/api/exercises/${siblingExercise.id}`).send({ name: `Pec Deck ${suffix}` })
    assert.equal(restoreSiblingName.status, 200, restoreSiblingName.text)

    const recreateWithArchivedName = await ownerAgent.post('/api/exercises').send({ name: `Cable Fly ${suffix}`, categoryId: category.id })
    assert.equal(recreateWithArchivedName.status, 201, recreateWithArchivedName.text)
    assert.notEqual(recreateWithArchivedName.body.exercise.id, archivedExercise.id)

    // Archived exercise cannot be updated, merged, added to program days, or added/swapped into workouts
    const updateArchived = await ownerAgent.patch(`/api/exercises/${archivedExercise.id}`).send({ name: `Revived ${suffix}` })
    assert.equal(updateArchived.status, 404, updateArchived.text)

    const updateArchivedCategory = await ownerAgent.patch(`/api/exercises/${archivedExercise.id}/category`).send({ categoryId: category.id })
    assert.equal(updateArchivedCategory.status, 404, updateArchivedCategory.text)

    const mergeFromArchived = await ownerAgent.post(`/api/exercises/${archivedExercise.id}/merge`).send({ targetExerciseId: siblingExercise.id })
    assert.equal(mergeFromArchived.status, 404, mergeFromArchived.text)

    const mergeIntoArchived = await ownerAgent.post(`/api/exercises/${siblingExercise.id}/merge`).send({ targetExerciseId: archivedExercise.id })
    assert.equal(mergeIntoArchived.status, 404, mergeIntoArchived.text)

    const addArchivedToProgramDay = await ownerAgent
      .post(`/api/programs/${programOne.id}/days/${dayA.id}/exercises`)
      .send({ exerciseId: archivedExercise.id })
    assert.equal(addArchivedToProgramDay.status, 404, addArchivedToProgramDay.text)

    const addArchivedToSession = await ownerAgent
      .post(`/api/sessions/${activeSession.id}/exercises`)
      .send({ exerciseId: archivedExercise.id })
    assert.equal(addArchivedToSession.status, 404, addArchivedToSession.text)

    const swapToArchivedInSession = await ownerAgent
      .patch(`/api/sessions/${activeSession.id}/exercises/${activeSessionExercise.id}`)
      .send({ exerciseId: archivedExercise.id })
    assert.equal(swapToArchivedInSession.status, 404, swapToArchivedInSession.text)
  } finally {
    // Test data is isolated by unique names and is removed by the test database lifecycle.
  }
})
