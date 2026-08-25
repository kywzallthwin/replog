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

test('users can create, switch, copy, and safely edit multiple programs', async () => {
  const email = `program-test-${Date.now()}@example.com`
  const agent = request.agent(app)

  try {
    const registerResponse = await agent.post('/auth/register').send({
      email,
      username: 'Program Tester',
      password: 'password123',
    })
    assert.equal(registerResponse.status, 201, registerResponse.text)

    const initialProgramsResponse = await agent.get('/programs')
    assert.equal(initialProgramsResponse.status, 200, initialProgramsResponse.text)
    assert.equal(initialProgramsResponse.body.programs.length, 1)
    assert.equal(initialProgramsResponse.body.programs[0].name, 'Beginner Full Body')

    const starterProgramId = initialProgramsResponse.body.programs[0].id as string
    const starterDetailsResponse = await agent.get(`/programs/${starterProgramId}`)
    assert.equal(starterDetailsResponse.status, 200, starterDetailsResponse.text)
    const starterDayId = starterDetailsResponse.body.program.days[0].id as string

    const templateResponse = await agent.post('/programs').send({
      name: 'Upper Lower Trial',
      source: 'template',
      templateId: 'upper-lower',
    })
    assert.equal(templateResponse.status, 201, templateResponse.text)
    const trialProgramId = templateResponse.body.program.id as string

    const activateResponse = await agent.post(`/programs/${trialProgramId}/activate`)
    assert.equal(activateResponse.status, 200, activateResponse.text)
    assert.equal(activateResponse.body.program.isActive, true)

    const inactiveStartResponse = await agent.post('/sessions').send({ dayId: starterDayId })
    assert.equal(inactiveStartResponse.status, 404, inactiveStartResponse.text)

    const copyResponse = await agent.post('/programs').send({
      name: 'Upper Lower Copy',
      source: 'copy',
      sourceProgramId: trialProgramId,
    })
    assert.equal(copyResponse.status, 201, copyResponse.text)
    const copyProgramId = copyResponse.body.program.id as string

    const renameResponse = await agent.patch(`/programs/${copyProgramId}`).send({ name: 'Upper Lower Copy Renamed' })
    assert.equal(renameResponse.status, 200, renameResponse.text)
    assert.equal(renameResponse.body.program.name, 'Upper Lower Copy Renamed')

    const deleteCopyResponse = await agent.delete(`/programs/${copyProgramId}`)
    assert.equal(deleteCopyResponse.status, 204, deleteCopyResponse.text)

    const trialDetailsResponse = await agent.get(`/programs/${trialProgramId}`)
    const trialDay = trialDetailsResponse.body.program.days[0]
    const sessionResponse = await agent.post('/sessions').send({ dayId: trialDay.id })
    assert.equal(sessionResponse.status, 201, sessionResponse.text)
    const sessionId = sessionResponse.body.session.id as string
    const sessionExercise = sessionResponse.body.session.exercises[0]
    const alternateExerciseId = trialDay.exercises[1].exerciseId as string

    const blockedSwitchResponse = await agent.post(`/programs/${starterProgramId}/activate`)
    assert.equal(blockedSwitchResponse.status, 409, blockedSwitchResponse.text)

    const addSetResponse = await agent.post(`/sessions/${sessionId}/exercises/${sessionExercise.id}/sets`).send({
      kind: 'NORMAL',
      notes: 'Last 2 reps had partial range.',
      weightKg: 20,
      reps: 8,
    })
    assert.equal(addSetResponse.status, 201, addSetResponse.text)
    assert.equal(addSetResponse.body.set.notes, 'Last 2 reps had partial range.')

    const chainResponse = await agent
      .post(`/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/batch`)
      .send({
        sets: [
          { kind: 'NORMAL', weightKg: 18, reps: 6 },
          { kind: 'DROP', weightKg: 15, reps: 4 },
          { kind: 'DROP', weightKg: 12, reps: 5 },
        ],
      })
    assert.equal(chainResponse.status, 201, chainResponse.text)
    assert.equal(chainResponse.body.sets.length, 3)
    const chainRootId = chainResponse.body.sets[0].id as string
    assert.equal(chainResponse.body.sets[0].parentSetId, null)
    assert.equal(chainResponse.body.sets[1].parentSetId, chainRootId)
    assert.equal(chainResponse.body.sets[2].parentSetId, chainRootId)

    const dropResponse = await agent
      .post(`/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/batch`)
      .send({
        parentSetId: addSetResponse.body.set.id,
        sets: [{ kind: 'DROP', weightKg: 17.5, reps: 5 }],
      })
    assert.equal(dropResponse.status, 201, dropResponse.text)
    assert.equal(dropResponse.body.sets[0].parentSetId, addSetResponse.body.set.id)

    const updateSetResponse = await agent
      .patch(`/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/${addSetResponse.body.set.id}`)
      .send({ notes: 'Full depth throughout.' })
    assert.equal(updateSetResponse.status, 200, updateSetResponse.text)
    assert.equal(updateSetResponse.body.set.notes, 'Full depth throughout.')

    const setDetailsResponse = await agent.get(`/sessions/${sessionId}`)
    assert.equal(setDetailsResponse.status, 200, setDetailsResponse.text)
    assert.equal(setDetailsResponse.body.session.exercises[0].sets[0].notes, 'Full depth throughout.')
    assert.equal(setDetailsResponse.body.session.exercises[0].sets.length, 5)

    const invalidSetNoteResponse = await agent
      .patch(`/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/${addSetResponse.body.set.id}`)
      .send({ notes: 'x'.repeat(301) })
    assert.equal(invalidSetNoteResponse.status, 400, invalidSetNoteResponse.text)

    const swapResponse = await agent
      .patch(`/sessions/${sessionId}/exercises/${sessionExercise.id}`)
      .send({ exerciseId: alternateExerciseId })
    assert.equal(swapResponse.status, 409, swapResponse.text)

    const finishResponse = await agent.patch(`/sessions/${sessionId}/finish`)
    assert.equal(finishResponse.status, 200, finishResponse.text)

    const completedSetUpdateResponse = await agent
      .patch(`/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/${addSetResponse.body.set.id}`)
      .send({ notes: 'Should be rejected.' })
    assert.equal(completedSetUpdateResponse.status, 409, completedSetUpdateResponse.text)

    const nextSessionResponse = await agent.post('/sessions').send({ dayId: trialDay.id })
    assert.equal(nextSessionResponse.status, 201, nextSessionResponse.text)
    const nextSessionId = nextSessionResponse.body.session.id as string
    const nextSessionDetailsResponse = await agent.get(`/sessions/${nextSessionId}`)
    assert.equal(nextSessionDetailsResponse.status, 200, nextSessionDetailsResponse.text)
    assert.deepEqual(nextSessionDetailsResponse.body.session.exercises[0].lastTime, {
      sessionId,
      performedAt: nextSessionDetailsResponse.body.session.exercises[0].lastTime.performedAt,
      weightKg: 20,
      reps: 8,
    })

    const cancelResponse = await agent.delete(`/sessions/${nextSessionId}`)
    assert.equal(cancelResponse.status, 204, cancelResponse.text)
  } finally {
    await prisma.user.deleteMany({ where: { email } })
  }
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

test('session notes are normalized, owner-scoped, and saved atomically with finish', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ownerEmail = `session-notes-owner-${suffix}@example.com`
  const otherEmail = `session-notes-other-${suffix}@example.com`
  const ownerAgent = request.agent(app)
  const otherAgent = request.agent(app)

  try {
    const ownerRegisterResponse = await ownerAgent.post('/auth/register').send({
      email: ownerEmail,
      username: 'Session Notes Owner',
      password: 'password123',
    })
    assert.equal(ownerRegisterResponse.status, 201, ownerRegisterResponse.text)

    const otherRegisterResponse = await otherAgent.post('/auth/register').send({
      email: otherEmail,
      username: 'Session Notes Other',
      password: 'password123',
    })
    assert.equal(otherRegisterResponse.status, 201, otherRegisterResponse.text)

    const programsResponse = await ownerAgent.get('/programs')
    assert.equal(programsResponse.status, 200, programsResponse.text)
    const programDetailsResponse = await ownerAgent.get(`/programs/${programsResponse.body.programs[0].id}`)
    assert.equal(programDetailsResponse.status, 200, programDetailsResponse.text)
    const dayId = programDetailsResponse.body.program.days[0].id as string

    const startResponse = await ownerAgent.post('/sessions').send({ dayId })
    assert.equal(startResponse.status, 201, startResponse.text)
    const sessionId = startResponse.body.session.id as string
    assert.equal(startResponse.body.session.notes, null)

    const initialDetailsResponse = await ownerAgent.get(`/sessions/${sessionId}`)
    assert.equal(initialDetailsResponse.status, 200, initialDetailsResponse.text)
    assert.equal(initialDetailsResponse.body.session.notes, null)

    const saveResponse = await ownerAgent.patch(`/sessions/${sessionId}/notes`).send({
      notes: '  Strong session with a controlled final set.  ',
    })
    assert.equal(saveResponse.status, 200, saveResponse.text)
    assert.equal(saveResponse.body.notes, 'Strong session with a controlled final set.')

    const savedDetailsResponse = await ownerAgent.get(`/sessions/${sessionId}`)
    assert.equal(savedDetailsResponse.body.session.notes, 'Strong session with a controlled final set.')

    const whitespaceResponse = await ownerAgent.patch(`/sessions/${sessionId}/notes`).send({ notes: '   ' })
    assert.equal(whitespaceResponse.status, 200, whitespaceResponse.text)
    assert.equal(whitespaceResponse.body.notes, null)

    const exactLimitNotes = 'n'.repeat(2000)
    const exactLimitResponse = await ownerAgent.patch(`/sessions/${sessionId}/notes`).send({ notes: exactLimitNotes })
    assert.equal(exactLimitResponse.status, 200, exactLimitResponse.text)
    assert.equal(exactLimitResponse.body.notes, exactLimitNotes)

    const tooLongResponse = await ownerAgent.patch(`/sessions/${sessionId}/notes`).send({ notes: 'n'.repeat(2001) })
    assert.equal(tooLongResponse.status, 400, tooLongResponse.text)

    const otherUserResponse = await otherAgent.patch(`/sessions/${sessionId}/notes`).send({ notes: 'Private note' })
    assert.equal(otherUserResponse.status, 404, otherUserResponse.text)

    const invalidFinishResponse = await ownerAgent.patch(`/sessions/${sessionId}/finish`).send({
      notes: 'f'.repeat(2001),
    })
    assert.equal(invalidFinishResponse.status, 400, invalidFinishResponse.text)

    const stillActiveResponse = await ownerAgent.get(`/sessions/${sessionId}`)
    assert.equal(stillActiveResponse.status, 200, stillActiveResponse.text)
    assert.equal(stillActiveResponse.body.session.endedAt, null)
    assert.equal(stillActiveResponse.body.session.notes, exactLimitNotes)

    const finishResponse = await ownerAgent.patch(`/sessions/${sessionId}/finish`).send({
      notes: '  Final note wins over the autosaved draft.  ',
    })
    assert.equal(finishResponse.status, 200, finishResponse.text)
    assert.equal(finishResponse.body.session.notes, 'Final note wins over the autosaved draft.')
    assert.ok(finishResponse.body.session.endedAt)

    const completedDetailsResponse = await ownerAgent.get(`/sessions/${sessionId}`)
    assert.equal(completedDetailsResponse.status, 200, completedDetailsResponse.text)
    assert.equal(completedDetailsResponse.body.session.notes, 'Final note wins over the autosaved draft.')

    const completedSaveResponse = await ownerAgent.patch(`/sessions/${sessionId}/notes`).send({ notes: 'Too late' })
    assert.equal(completedSaveResponse.status, 409, completedSaveResponse.text)
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
  }
})
