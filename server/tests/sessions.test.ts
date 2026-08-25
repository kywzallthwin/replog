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
    const ownerRegisterResponse = await ownerAgent.post('/auth/register').send({
      email: ownerEmail,
      username: 'Last Time Owner',
      password: 'password123',
    })
    assert.equal(ownerRegisterResponse.status, 201, ownerRegisterResponse.text)

    const otherRegisterResponse = await otherAgent.post('/auth/register').send({
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

    await createCompletedSession(ownerId, new Date('2026-01-01T10:00:00.000Z'), [
      {
        exerciseId: temporalExercise.id,
        name: temporalExercise.name,
        sets: [{ kind: 'NORMAL', weightKg: 80, reps: 10 }],
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

    const detailsResponse = await ownerAgent.get(`/sessions/${viewedSession.id}`)
    assert.equal(detailsResponse.status, 200, detailsResponse.text)
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

    const oneRepProgressResponse = await ownerAgent.get(`/progress?exerciseId=${oneRepExercise.id}`)
    assert.equal(oneRepProgressResponse.status, 200, oneRepProgressResponse.text)
    assert.equal(oneRepProgressResponse.body.personalBest.weightKg, 96)
    assert.equal(oneRepProgressResponse.body.personalBest.reps, 2)

    const tieProgressResponse = await ownerAgent.get(`/progress?exerciseId=${tieExercise.id}`)
    assert.equal(tieProgressResponse.status, 200, tieProgressResponse.text)
    assert.equal(tieProgressResponse.body.personalBest.weightKg, 112.5)
    assert.equal(tieProgressResponse.body.personalBest.reps, 2)
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
  }
})
