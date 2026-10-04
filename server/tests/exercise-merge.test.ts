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

    const builtInTarget = await prisma.exercise.findFirstOrThrow({ where: { ownerId: null, id: { not: builtIn.id } } })
    const builtInTargetSource = await prisma.exercise.create({ data: { name: `Built-in Target Source ${suffix}`, categoryId: category.id, ownerId } })
    const builtInTargetResponse = await ownerAgent.post(`/api/exercises/${builtInTargetSource.id}/merge`).send({ targetExerciseId: builtInTarget.id })
    assert.equal(builtInTargetResponse.status, 404, builtInTargetResponse.text)
    assert.ok(await prisma.exercise.findUnique({ where: { id: builtInTargetSource.id } }))

    const validationSource = await prisma.exercise.create({ data: { name: `Validation Source ${suffix}`, categoryId: category.id, ownerId } })
    const otherTarget = await prisma.exercise.create({ data: { name: `Other Target ${suffix}`, categoryId: category.id, ownerId: otherId } })
    const validationProgram = await prisma.program.create({
      data: {
        ownerId,
        name: `Validation Program ${suffix}`,
        nameKey: `validation-program-${suffix}`,
        days: {
          create: [{ name: 'Validation day', badgeColor: 'bg-blue-100 text-blue-800', order: 1, dayExercises: { create: [{ exerciseId: validationSource.id, order: 1 }] } }],
        },
      },
      include: { days: { include: { dayExercises: true } } },
    })
    const otherTargetResponse = await ownerAgent.post(`/api/exercises/${validationSource.id}/merge`).send({ targetExerciseId: otherTarget.id })
    assert.equal(otherTargetResponse.status, 404, otherTargetResponse.text)
    assert.ok(await prisma.exercise.findUnique({ where: { id: validationSource.id } }))
    assert.deepEqual(await prisma.dayExercise.findMany({ where: { day: { programId: validationProgram.id } }, select: { exerciseId: true, order: true } }), [{ exerciseId: validationSource.id, order: 1 }])
    const sameIdResponse = await ownerAgent.post(`/api/exercises/${validationSource.id}/merge`).send({ targetExerciseId: validationSource.id })
    assert.equal(sameIdResponse.status, 400, sameIdResponse.text)
    const invalidInputResponse = await ownerAgent.post(`/api/exercises/${validationSource.id}/merge`).send({ targetExerciseId: '   ' })
    assert.equal(invalidInputResponse.status, 400, invalidInputResponse.text)
    assert.ok(await prisma.exercise.findUnique({ where: { id: validationSource.id } }))
  } finally {
    // Test data is isolated by unique email and is removed by the test database lifecycle.
  }
})

test('rejects a merge when the source or keeper is in an unfinished workout', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const agent = request.agent(app)
  const keeperAgent = request.agent(app)
  const registerResponse = await agent.post('/api/auth/register').send({ email: `merge-active-${suffix}@example.com`, username: 'Merge Active', password: 'password123' })
  assert.equal(registerResponse.status, 201, registerResponse.text)
  const userId = registerResponse.body.user.id as string
  const keeperRegisterResponse = await keeperAgent.post('/api/auth/register').send({ email: `merge-keeper-active-${suffix}@example.com`, username: 'Merge Keeper Active', password: 'password123' })
  assert.equal(keeperRegisterResponse.status, 201, keeperRegisterResponse.text)
  const keeperUserId = keeperRegisterResponse.body.user.id as string
  const category = await prisma.exerciseCategory.findFirstOrThrow({ where: { ownerId: null } })
  const sourceActiveTarget = await prisma.exercise.create({ data: { name: `Source Active Keeper ${suffix}`, categoryId: category.id, ownerId: userId } })
  const sourceActive = await prisma.exercise.create({ data: { name: `Source Active ${suffix}`, categoryId: category.id, ownerId: userId } })
  const sourceProgram = await prisma.program.create({ data: { ownerId: userId, name: `Source Active Program ${suffix}`, nameKey: `source-active-program-${suffix}` } })
  const sourceDay = await prisma.day.create({ data: { programId: sourceProgram.id, name: 'Source active day', badgeColor: 'bg-blue-100 text-blue-800', order: 1 } })
  const sourceSession = await prisma.session.create({ data: { userId, programId: sourceProgram.id, dayId: sourceDay.id, dayNameSnapshot: sourceDay.name, badgeColorSnapshot: sourceDay.badgeColor, sessionExercises: { create: [{ exerciseId: sourceActive.id, nameSnapshot: sourceActive.name, order: 1 }] } } })

  const sourceResponse = await agent.post(`/api/exercises/${sourceActive.id}/merge`).send({ targetExerciseId: sourceActiveTarget.id })
  assert.equal(sourceResponse.status, 409, sourceResponse.text)
  assert.ok(await prisma.exercise.findUnique({ where: { id: sourceActive.id } }))
  assert.ok(await prisma.exercise.findUnique({ where: { id: sourceActiveTarget.id } }))
  assert.deepEqual(await prisma.sessionExercise.findMany({ where: { sessionId: sourceSession.id }, select: { exerciseId: true, order: true } }), [{ exerciseId: sourceActive.id, order: 1 }])

  const keeperActiveTarget = await prisma.exercise.create({ data: { name: `Keeper Active Keeper ${suffix}`, categoryId: category.id, ownerId: keeperUserId } })
  const keeperActiveSource = await prisma.exercise.create({ data: { name: `Keeper Active Source ${suffix}`, categoryId: category.id, ownerId: keeperUserId } })
  const keeperProgram = await prisma.program.create({ data: { ownerId: keeperUserId, name: `Keeper Active Program ${suffix}`, nameKey: `keeper-active-program-${suffix}` } })
  const keeperDay = await prisma.day.create({ data: { programId: keeperProgram.id, name: 'Keeper active day', badgeColor: 'bg-blue-100 text-blue-800', order: 1 } })
  const keeperSession = await prisma.session.create({ data: { userId: keeperUserId, programId: keeperProgram.id, dayId: keeperDay.id, dayNameSnapshot: keeperDay.name, badgeColorSnapshot: keeperDay.badgeColor, sessionExercises: { create: [{ exerciseId: keeperActiveTarget.id, nameSnapshot: keeperActiveTarget.name, order: 1 }] } } })

  const keeperResponse = await keeperAgent.post(`/api/exercises/${keeperActiveSource.id}/merge`).send({ targetExerciseId: keeperActiveTarget.id })
  assert.equal(keeperResponse.status, 409, keeperResponse.text)
  assert.ok(await prisma.exercise.findUnique({ where: { id: keeperActiveSource.id } }))
  assert.ok(await prisma.exercise.findUnique({ where: { id: keeperActiveTarget.id } }))
  assert.deepEqual(await prisma.sessionExercise.findMany({ where: { sessionId: keeperSession.id }, select: { exerciseId: true, order: true } }), [{ exerciseId: keeperActiveTarget.id, order: 1 }])
})
