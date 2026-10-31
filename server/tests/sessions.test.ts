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

test('last-time references use the latest owned earlier workout and the Progress strength rules', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ownerEmail = `last-time-owner-${suffix}@example.com`
  const otherEmail = `last-time-other-${suffix}@example.com`
  const ownerAgent = request.agent(app)
  const otherAgent = request.agent(app)

  try {
    const ownerRegisterResponse = await ownerAgent.post('/api/auth/register').send({
      email: ownerEmail,
      username: 'Last Time Owner',
      password: 'password123',
    })
    assert.equal(ownerRegisterResponse.status, 201, ownerRegisterResponse.text)

    const otherRegisterResponse = await otherAgent.post('/api/auth/register').send({
      email: otherEmail,
      username: 'Last Time Other',
      password: 'password123',
    })
    assert.equal(otherRegisterResponse.status, 201, otherRegisterResponse.text)

    const ownerId = ownerRegisterResponse.body.user.id as string
    const otherUserId = otherRegisterResponse.body.user.id as string
    const exercises = await prisma.exercise.findMany({
      where: { ownerId: null },
      orderBy: { name: 'asc' },
      take: 3,
    })
    assert.equal(exercises.length, 3)
    const [oneRepExercise, tieExercise, temporalExercise] = exercises
    assert.ok(oneRepExercise)
    assert.ok(tieExercise)
    assert.ok(temporalExercise)

    type SetFixture = {
      kind: 'WARMUP' | 'NORMAL' | 'DROP'
      weightKg: number
      reps: number
    }
    type ExerciseFixture = {
      exerciseId: string
      name: string
      sets: SetFixture[]
    }

    async function createCompletedSession(userId: string, startedAt: Date, sessionExercises: ExerciseFixture[]) {
      return prisma.session.create({
        data: {
          userId,
          dayNameSnapshot: 'TEST DAY',
          badgeColorSnapshot: 'neutral',
          startedAt,
          endedAt: new Date(startedAt.getTime() + 60 * 60 * 1000),
          durationSec: 60 * 60,
          sessionExercises: {
            create: sessionExercises.map((exercise, exerciseIndex) => ({
              exerciseId: exercise.exerciseId,
              nameSnapshot: exercise.name,
              order: exerciseIndex + 1,
              setLogs: {
                create: exercise.sets.map((set, setIndex) => ({
                  ...set,
                  order: setIndex + 1,
                })),
              },
            })),
          },
        },
      })
    }

    async function createUnfinishedSession(userId: string, startedAt: Date, sessionExercises: ExerciseFixture[]) {
      return prisma.session.create({
        data: {
          userId,
          dayNameSnapshot: 'TEST DAY',
          badgeColorSnapshot: 'neutral',
          startedAt,
          sessionExercises: {
            create: sessionExercises.map((exercise, exerciseIndex) => ({
              exerciseId: exercise.exerciseId,
              nameSnapshot: exercise.name,
              order: exerciseIndex + 1,
              setLogs: {
                create: exercise.sets.map((set, setIndex) => ({
                  ...set,
                  order: setIndex + 1,
                })),
              },
            })),
          },
        },
      })
    }

    await createCompletedSession(ownerId, new Date('2026-01-01T10:00:00.000Z'), [
      {
        exerciseId: temporalExercise.id,
        name: temporalExercise.name,
        sets: [{ kind: 'NORMAL', weightKg: 80, reps: 10 }],
      },
    ])

    await createUnfinishedSession(ownerId, new Date('2026-01-01T18:00:00.000Z'), [
      {
        exerciseId: temporalExercise.id,
        name: temporalExercise.name,
        sets: [{ kind: 'NORMAL', weightKg: 999, reps: 10 }],
      },
    ])

    const latestPreviousSession = await createCompletedSession(ownerId, new Date('2026-01-02T10:00:00.000Z'), [
      {
        exerciseId: oneRepExercise.id,
        name: oneRepExercise.name,
        sets: [
          { kind: 'WARMUP', weightKg: 500, reps: 20 },
          { kind: 'DROP', weightKg: 400, reps: 20 },
          { kind: 'NORMAL', weightKg: 100, reps: 1 },
          { kind: 'NORMAL', weightKg: 96, reps: 2 },
        ],
      },
      {
        exerciseId: tieExercise.id,
        name: tieExercise.name,
        sets: [
          { kind: 'NORMAL', weightKg: 100, reps: 6 },
          { kind: 'NORMAL', weightKg: 112.5, reps: 2 },
        ],
      },
      {
        exerciseId: temporalExercise.id,
        name: temporalExercise.name,
        sets: [{ kind: 'NORMAL', weightKg: 50, reps: 5 }],
      },
    ])

    await createCompletedSession(otherUserId, new Date('2026-01-02T18:00:00.000Z'), [
      {
        exerciseId: temporalExercise.id,
        name: temporalExercise.name,
        sets: [{ kind: 'NORMAL', weightKg: 300, reps: 10 }],
      },
    ])

    const viewedSession = await createCompletedSession(ownerId, new Date('2026-01-03T10:00:00.000Z'), [
      { exerciseId: oneRepExercise.id, name: oneRepExercise.name, sets: [] },
      { exerciseId: tieExercise.id, name: tieExercise.name, sets: [] },
      { exerciseId: temporalExercise.id, name: temporalExercise.name, sets: [] },
    ])

    await createCompletedSession(ownerId, new Date('2026-01-04T10:00:00.000Z'), [
      {
        exerciseId: temporalExercise.id,
        name: temporalExercise.name,
        sets: [{ kind: 'NORMAL', weightKg: 200, reps: 10 }],
      },
    ])

    const detailsResponse = await ownerAgent.get(`/api/sessions/${viewedSession.id}`)
    assert.equal(detailsResponse.status, 200, detailsResponse.text)
    assert.equal(detailsResponse.body.session.notes, null)
    const detailsByExerciseId = new Map(
      detailsResponse.body.session.exercises.map((exercise: { exerciseId: string; lastTime: unknown }) => [
        exercise.exerciseId,
        exercise.lastTime,
      ]),
    )

    assert.deepEqual(detailsByExerciseId.get(oneRepExercise.id), {
      sessionId: latestPreviousSession.id,
      performedAt: latestPreviousSession.startedAt.toISOString(),
      weightKg: 96,
      reps: 2,
    })
    assert.deepEqual(detailsByExerciseId.get(tieExercise.id), {
      sessionId: latestPreviousSession.id,
      performedAt: latestPreviousSession.startedAt.toISOString(),
      weightKg: 112.5,
      reps: 2,
    })
    assert.deepEqual(detailsByExerciseId.get(temporalExercise.id), {
      sessionId: latestPreviousSession.id,
      performedAt: latestPreviousSession.startedAt.toISOString(),
      weightKg: 50,
      reps: 5,
    })

    const oneRepDetails = detailsResponse.body.session.exercises.find(
      (exercise: { exerciseId: string }) => exercise.exerciseId === oneRepExercise.id,
    )
    assert.deepEqual(
      oneRepDetails.previousWorkout.sets.map((set: { kind: string; weightKg: number; reps: number }) => ({
        kind: set.kind,
        weightKg: set.weightKg,
        reps: set.reps,
      })),
      [
        { kind: 'WARMUP', weightKg: 500, reps: 20 },
        { kind: 'DROP', weightKg: 400, reps: 20 },
        { kind: 'NORMAL', weightKg: 100, reps: 1 },
        { kind: 'NORMAL', weightKg: 96, reps: 2 },
      ],
    )
    assert.equal(
      oneRepDetails.previousWorkout.bestNormalSetId,
      oneRepDetails.previousWorkout.sets[3].id,
    )

    const oneRepProgressResponse = await ownerAgent.get(`/api/progress?exerciseId=${oneRepExercise.id}`)
    assert.equal(oneRepProgressResponse.status, 200, oneRepProgressResponse.text)
    assert.equal(oneRepProgressResponse.body.personalBest.weightKg, 96)
    assert.equal(oneRepProgressResponse.body.personalBest.reps, 2)

    const tieProgressResponse = await ownerAgent.get(`/api/progress?exerciseId=${tieExercise.id}`)
    assert.equal(tieProgressResponse.status, 200, tieProgressResponse.text)
    assert.equal(tieProgressResponse.body.personalBest.weightKg, 112.5)
    assert.equal(tieProgressResponse.body.personalBest.reps, 2)
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
  }
})

test('the removed workout-note route returns the normal API not-found response', async () => {
  const response = await request(app).patch('/api/sessions/removed-session/notes').send({ notes: 'not supported' })

  assert.equal(response.status, 404, response.text)
  assert.deepEqual(response.body, { error: 'API route not found' })
})

test('active session exercise reordering renumbers exercises transactionally without mutating the source program day or allowing completed-session edits', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ownerEmail = `reorder-owner-${suffix}@example.com`
  const otherEmail = `reorder-other-${suffix}@example.com`
  const ownerAgent = request.agent(app)
  const otherAgent = request.agent(app)

  try {
    const ownerRegisterResponse = await ownerAgent.post('/api/auth/register').send({
      email: ownerEmail,
      username: 'Reorder Owner',
      password: 'password123',
    })
    assert.equal(ownerRegisterResponse.status, 201, ownerRegisterResponse.text)

    const otherRegisterResponse = await otherAgent.post('/api/auth/register').send({
      email: otherEmail,
      username: 'Reorder Other',
      password: 'password123',
    })
    assert.equal(otherRegisterResponse.status, 201, otherRegisterResponse.text)

    const activeProgramResponse = await ownerAgent.get('/api/programs/active')
    assert.equal(activeProgramResponse.status, 200, activeProgramResponse.text)
    const sourceDay = activeProgramResponse.body.program.days[0] as {
      id: string
      exercises: Array<{ id: string; exerciseId: string; name: string; order: number }>
    }
    assert.ok(sourceDay)
    assert.ok(sourceDay.exercises.length >= 3)
    const originalProgramExerciseIds = sourceDay.exercises.map((exercise) => exercise.exerciseId)
    const originalProgramOrders = sourceDay.exercises.map((exercise) => exercise.order)

    const startResponse = await ownerAgent.post('/api/sessions').send({ dayId: sourceDay.id })
    assert.equal(startResponse.status, 201, startResponse.text)
    const sessionId = startResponse.body.session.id as string
    const initialExercises = startResponse.body.session.exercises as Array<{
      id: string
      exerciseId: string
      name: string
      order: number
    }>
    assert.equal(initialExercises.length, sourceDay.exercises.length)
    const [firstExercise, secondExercise, thirdExercise] = initialExercises
    assert.ok(firstExercise)
    assert.ok(secondExercise)
    assert.ok(thirdExercise)

    const addSetResponse = await ownerAgent
      .post(`/api/sessions/${sessionId}/exercises/${firstExercise.id}/sets`)
      .send({ kind: 'NORMAL', weightKg: 75, reps: 8 })
    assert.equal(addSetResponse.status, 201, addSetResponse.text)

    const unauthenticatedResponse = await request(app)
      .patch(`/api/sessions/${sessionId}/exercises/${firstExercise.id}/reorder`)
      .send({ targetIndex: 2 })
    assert.equal(unauthenticatedResponse.status, 401, unauthenticatedResponse.text)

    const unauthorizedResponse = await otherAgent
      .patch(`/api/sessions/${sessionId}/exercises/${firstExercise.id}/reorder`)
      .send({ targetIndex: 2 })
    assert.equal(unauthorizedResponse.status, 404, unauthorizedResponse.text)

    const invalidBodyResponse = await ownerAgent
      .patch(`/api/sessions/${sessionId}/exercises/${firstExercise.id}/reorder`)
      .send({ targetIndex: -1 })
    assert.equal(invalidBodyResponse.status, 400, invalidBodyResponse.text)

    const outOfRangeResponse = await ownerAgent
      .patch(`/api/sessions/${sessionId}/exercises/${firstExercise.id}/reorder`)
      .send({ targetIndex: initialExercises.length })
    assert.equal(outOfRangeResponse.status, 400, outOfRangeResponse.text)
    assert.deepEqual(outOfRangeResponse.body, { error: 'Invalid target exercise position' })

    const missingExerciseResponse = await ownerAgent
      .patch(`/api/sessions/${sessionId}/exercises/missing-session-exercise/reorder`)
      .send({ targetIndex: 0 })
    assert.equal(missingExerciseResponse.status, 404, missingExerciseResponse.text)
    assert.deepEqual(missingExerciseResponse.body, { error: 'Session exercise not found' })

    const reorderResponse = await ownerAgent
      .patch(`/api/sessions/${sessionId}/exercises/${firstExercise.id}/reorder`)
      .send({ targetIndex: 2 })
    assert.equal(reorderResponse.status, 200, reorderResponse.text)

    const reorderedExercises = reorderResponse.body.exercises as Array<{
      id: string
      exerciseId: string
      order: number
      sets: Array<{ weightKg: number; reps: number }>
    }>
    assert.deepEqual(
      reorderedExercises.slice(0, 3).map((exercise) => ({ id: exercise.id, order: exercise.order })),
      [
        { id: secondExercise.id, order: 1 },
        { id: thirdExercise.id, order: 2 },
        { id: firstExercise.id, order: 3 },
      ],
    )
    assert.equal(reorderedExercises[2]?.sets.length, 1)
    assert.equal(reorderedExercises[2]?.sets[0]?.weightKg, 75)

    const refreshedResponse = await ownerAgent.get(`/api/sessions/${sessionId}`)
    assert.equal(refreshedResponse.status, 200, refreshedResponse.text)
    assert.deepEqual(
      refreshedResponse.body.session.exercises.slice(0, 3).map((exercise: { id: string; order: number }) => ({
        id: exercise.id,
        order: exercise.order,
      })),
      [
        { id: secondExercise.id, order: 1 },
        { id: thirdExercise.id, order: 2 },
        { id: firstExercise.id, order: 3 },
      ],
    )

    const programAfterReorderResponse = await ownerAgent.get('/api/programs/active')
    assert.equal(programAfterReorderResponse.status, 200, programAfterReorderResponse.text)
    const dayAfterReorder = programAfterReorderResponse.body.program.days[0] as {
      exercises: Array<{ exerciseId: string; order: number }>
    }
    assert.deepEqual(
      dayAfterReorder.exercises.map((exercise) => exercise.exerciseId),
      originalProgramExerciseIds,
    )
    assert.deepEqual(
      dayAfterReorder.exercises.map((exercise) => exercise.order),
      originalProgramOrders,
    )

    const finishResponse = await ownerAgent.patch(`/api/sessions/${sessionId}/finish`)
    assert.equal(finishResponse.status, 200, finishResponse.text)
    assert.deepEqual(
      finishResponse.body.session.exercises.slice(0, 3).map((exercise: { id: string; order: number }) => ({
        id: exercise.id,
        order: exercise.order,
      })),
      [
        { id: secondExercise.id, order: 1 },
        { id: thirdExercise.id, order: 2 },
        { id: firstExercise.id, order: 3 },
      ],
    )

    const reorderCompletedResponse = await ownerAgent
      .patch(`/api/sessions/${sessionId}/exercises/${firstExercise.id}/reorder`)
      .send({ targetIndex: 0 })
    assert.equal(reorderCompletedResponse.status, 409, reorderCompletedResponse.text)
    assert.deepEqual(reorderCompletedResponse.body, { error: 'Finished workouts cannot be edited' })
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
  }
})
