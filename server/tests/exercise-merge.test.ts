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

test('merges exercises while preserving completed workout entries and progress ownership', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ownerAgent = request.agent(app)
  const otherAgent = request.agent(app)

  try {
    const ownerResponse = await ownerAgent.post('/api/auth/register').send({ email: `merge-owner-${suffix}@example.com`, username: 'Merge Owner', password: 'password123' })
    const otherResponse = await otherAgent.post('/api/auth/register').send({ email: `merge-other-${suffix}@example.com`, username: 'Merge Other', password: 'password123' })
    assert.equal(ownerResponse.status, 201, ownerResponse.text)
    assert.equal(otherResponse.status, 201, otherResponse.text)

    const ownerId = ownerResponse.body.user.id as string
    const otherId = otherResponse.body.user.id as string
    const category = await prisma.exerciseCategory.findFirstOrThrow({ where: { ownerId: null } })
    const target = await prisma.exercise.create({ data: { name: `Keeper ${suffix}`, categoryId: category.id, ownerId } })
    const source = await prisma.exercise.create({ data: { name: `Vague ${suffix}`, categoryId: category.id, ownerId } })
    const otherSource = await prisma.exercise.create({ data: { name: `Other Source ${suffix}`, categoryId: category.id, ownerId: otherId } })
    const builtIn = await prisma.exercise.findFirstOrThrow({ where: { ownerId: null } })

    const program = await prisma.program.create({
      data: {
        ownerId,
        name: `Merge Program ${suffix}`,
        nameKey: `merge-program-${suffix}`,
        days: {
          create: [
            {
              name: 'Duplicate day',
              badgeColor: 'bg-blue-100 text-blue-800',
              order: 1,
              dayExercises: {
                create: [
                  { exerciseId: target.id, order: 1 },
                  { exerciseId: source.id, order: 2 },
                  { exerciseId: builtIn.id, order: 3 },
                ],
              },
            },
            {
              name: 'Source only day',
              badgeColor: 'bg-green-100 text-green-800',
              order: 2,
              dayExercises: { create: [{ exerciseId: source.id, order: 1 }] },
            },
          ],
        },
      },
      include: { days: { orderBy: { order: 'asc' }, include: { dayExercises: true } } },
    })

    const session = await prisma.session.create({
      data: {
        userId: ownerId,
        programId: program.id,
        dayNameSnapshot: 'Completed day',
        badgeColorSnapshot: 'bg-blue-100 text-blue-800',
        endedAt: new Date('2026-01-02T10:00:00.000Z'),
        sessionExercises: {
          create: [
            { exerciseId: source.id, nameSnapshot: 'Vague as logged', order: 1, setLogs: { create: [{ kind: 'NORMAL', weightKg: 80, reps: 5, order: 1 }] } },
            { exerciseId: target.id, nameSnapshot: 'Keeper as logged', order: 2, setLogs: { create: [{ kind: 'NORMAL', weightKg: 100, reps: 5, order: 1 }] } },
          ],
        },
      },
      include: { sessionExercises: { include: { setLogs: true } } },
    })

    await prisma.session.create({
      data: {
        userId: otherId,
        dayNameSnapshot: 'Other day',
        badgeColorSnapshot: 'bg-blue-100 text-blue-800',
        endedAt: new Date('2026-01-03T10:00:00.000Z'),
        sessionExercises: { create: [{ exerciseId: otherSource.id, nameSnapshot: otherSource.name, order: 1 }] },
      },
    })

    const mergeResponse = await ownerAgent.post(`/api/exercises/${source.id}/merge`).send({ targetExerciseId: target.id })
    assert.equal(mergeResponse.status, 200, mergeResponse.text)
    assert.equal(mergeResponse.body.changedProgramDayEntries, 2)
    assert.equal(mergeResponse.body.changedWorkoutEntries, 1)

    const days = await prisma.dayExercise.findMany({ where: { day: { programId: program.id } }, orderBy: [{ dayId: 'asc' }, { order: 'asc' }] })
    assert.deepEqual(days.filter((day) => day.dayId === program.days[0]?.id).map((day) => [day.exerciseId, day.order]), [[target.id, 1], [builtIn.id, 2]])
    assert.deepEqual(days.filter((day) => day.dayId === program.days[1]?.id).map((day) => [day.exerciseId, day.order]), [[target.id, 1]])

    const completedEntries = await prisma.sessionExercise.findMany({ where: { sessionId: session.id }, include: { setLogs: true }, orderBy: { order: 'asc' } })
    assert.deepEqual(completedEntries.map((entry) => [entry.exerciseId, entry.nameSnapshot, entry.order, entry.setLogs.length]), [
      [target.id, 'Vague as logged', 1, 1],
      [target.id, 'Keeper as logged', 2, 1],
    ])
    assert.equal(await prisma.exercise.findUnique({ where: { id: source.id } }), null)

    const progressResponse = await ownerAgent.get(`/api/progress?exerciseId=${target.id}`)
    assert.equal(progressResponse.status, 200, progressResponse.text)
    assert.equal(progressResponse.body.exercises.length, 1)
    assert.equal(progressResponse.body.stats.sessionCount, 1)
    assert.equal(progressResponse.body.stats.heaviestWeightKg, 100)
    assert.equal(progressResponse.body.personalBest.sessionId, session.id)
    assert.equal(progressResponse.body.sessionHistory.length, 1)

    const builtInMerge = await ownerAgent.post(`/api/exercises/${builtIn.id}/merge`).send({ targetExerciseId: target.id })
    assert.equal(builtInMerge.status, 200, builtInMerge.text)
    assert.ok(await prisma.exercise.findUnique({ where: { id: builtIn.id } }))

    const inaccessible = await ownerAgent.post(`/api/exercises/${otherSource.id}/merge`).send({ targetExerciseId: target.id })
    assert.equal(inaccessible.status, 404, inaccessible.text)
  } finally {
    // Test data is isolated by unique email and is removed by the test database lifecycle.
  }
})

test('rejects a merge when either exercise is in an unfinished workout', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const agent = request.agent(app)
  const registerResponse = await agent.post('/api/auth/register').send({ email: `merge-active-${suffix}@example.com`, username: 'Merge Active', password: 'password123' })
  assert.equal(registerResponse.status, 201, registerResponse.text)
  const userId = registerResponse.body.user.id as string
  const category = await prisma.exerciseCategory.findFirstOrThrow({ where: { ownerId: null } })
  const target = await prisma.exercise.create({ data: { name: `Active Keeper ${suffix}`, categoryId: category.id, ownerId: userId } })
  const source = await prisma.exercise.create({ data: { name: `Active Source ${suffix}`, categoryId: category.id, ownerId: userId } })
  const program = await prisma.program.create({ data: { ownerId: userId, name: `Active Program ${suffix}`, nameKey: `active-program-${suffix}` } })
  const day = await prisma.day.create({ data: { programId: program.id, name: 'Active day', badgeColor: 'bg-blue-100 text-blue-800', order: 1 } })
  await prisma.session.create({ data: { userId, programId: program.id, dayId: day.id, dayNameSnapshot: day.name, badgeColorSnapshot: day.badgeColor, sessionExercises: { create: [{ exerciseId: source.id, nameSnapshot: source.name, order: 1 }] } } })

  const response = await agent.post(`/api/exercises/${source.id}/merge`).send({ targetExerciseId: target.id })
  assert.equal(response.status, 409, response.text)
  assert.ok(await prisma.exercise.findUnique({ where: { id: source.id } }))
  assert.ok(await prisma.sessionExercise.findFirst({ where: { exerciseId: source.id } }))
})
