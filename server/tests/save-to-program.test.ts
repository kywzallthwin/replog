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

type DayPayload = {
  id: string
  name: string
  exercises: Array<{ exerciseId: string; order: number }>
}

async function registerAgent(email: string) {
  const agent = request.agent(app)
  const registerResponse = await agent.post('/api/auth/register').send({
    email,
    username: 'Save To Program',
    password: 'password123',
  })
  assert.equal(registerResponse.status, 201, registerResponse.text)
  return agent
}

test('saving an active workout updates the program day it was started from', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const email = `save-to-program-${suffix}@example.com`
  const agent = await registerAgent(email)

  try {
    const programsResponse = await agent.get('/api/programs')
    assert.equal(programsResponse.status, 200, programsResponse.text)
    assert.equal(programsResponse.body.programs.length, 1)
    const programId = programsResponse.body.programs[0].id as string

    const programResponse = await agent.get(`/api/programs/${programId}`)
    assert.equal(programResponse.status, 200, programResponse.text)
    const days = programResponse.body.program.days as DayPayload[]
    assert.equal(days.length, 3)
    const targetDay = days[0]
    const otherDay = days[1]
    assert.ok(targetDay)
    assert.ok(otherDay)
    const otherDayExercisesBefore = otherDay.exercises.map((exercise) => exercise.exerciseId)

    const startResponse = await agent.post('/api/sessions').send({ dayId: targetDay.id })
    assert.equal(startResponse.status, 201, startResponse.text)
    const sessionId = startResponse.body.session.id as string
    const sessionExercises = startResponse.body.session.exercises as Array<{ id: string; exerciseId: string }>
    assert.equal(sessionExercises.length, targetDay.exercises.length)

    const removedExercise = sessionExercises[0]
    assert.ok(removedExercise)
    const removeResponse = await agent.delete(`/api/sessions/${sessionId}/exercises/${removedExercise.id}`)
    assert.equal(removeResponse.status, 204, removeResponse.text)

    const extraExercise = await prisma.exercise.findFirst({ where: { name: 'Cable Fly', ownerId: null } })
    assert.ok(extraExercise)
    const addResponse = await agent.post(`/api/sessions/${sessionId}/exercises`).send({ exerciseId: extraExercise.id })
    assert.equal(addResponse.status, 201, addResponse.text)

    const loggedExercise = sessionExercises[1]
    assert.ok(loggedExercise)
    const setResponse = await agent
      .post(`/api/sessions/${sessionId}/exercises/${loggedExercise.id}/sets`)
      .send({ kind: 'NORMAL', weightKg: 40, reps: 8 })
    assert.equal(setResponse.status, 201, setResponse.text)

    const expectedExerciseIds = [
      ...sessionExercises.slice(1).map((exercise) => exercise.exerciseId),
      extraExercise.id,
    ]

    const saveResponse = await agent.post(`/api/sessions/${sessionId}/save-to-program`)
    assert.equal(saveResponse.status, 200, saveResponse.text)
    assert.equal(saveResponse.body.day.id, targetDay.id)
    assert.equal(saveResponse.body.day.name, targetDay.name)
    assert.deepEqual(
      saveResponse.body.day.exercises.map((exercise: { exerciseId: string }) => exercise.exerciseId),
      expectedExerciseIds,
    )

    const updatedProgramResponse = await agent.get(`/api/programs/${programId}`)
    assert.equal(updatedProgramResponse.status, 200, updatedProgramResponse.text)
    const updatedDays = updatedProgramResponse.body.program.days as DayPayload[]
    assert.equal(updatedDays.length, days.length)
    const updatedDay = updatedDays[0]
    const updatedOtherDay = updatedDays[1]
    assert.ok(updatedDay)
    assert.ok(updatedOtherDay)
    assert.deepEqual(updatedDay.exercises.map((exercise) => exercise.exerciseId), expectedExerciseIds)
    assert.deepEqual(
      updatedDay.exercises.map((exercise) => exercise.order),
      expectedExerciseIds.map((_, index) => index + 1),
    )
    assert.deepEqual(updatedOtherDay.exercises.map((exercise) => exercise.exerciseId), otherDayExercisesBefore)

    const programsAfterResponse = await agent.get('/api/programs')
    assert.equal(programsAfterResponse.status, 200, programsAfterResponse.text)
    assert.equal(programsAfterResponse.body.programs.length, 1)

    const sessionResponse = await agent.get(`/api/sessions/${sessionId}`)
    assert.equal(sessionResponse.status, 200, sessionResponse.text)
    assert.equal(sessionResponse.body.session.endedAt, null)
    assert.deepEqual(
      sessionResponse.body.session.exercises.map((exercise: { exerciseId: string }) => exercise.exerciseId),
      expectedExerciseIds,
    )
    assert.equal(sessionResponse.body.session.exercises[0].sets.length, 1)
    assert.equal(sessionResponse.body.session.exercises[0].sets[0].weightKg, 40)

    const historyResponse = await agent.get('/api/sessions/history')
    assert.equal(historyResponse.status, 200, historyResponse.text)
    const historySessions = historyResponse.body.sessions as Array<{ id: string }>
    assert.equal(historySessions.filter((session) => session.id === sessionId).length, 0)

    const finishResponse = await agent.patch(`/api/sessions/${sessionId}/finish`)
    assert.equal(finishResponse.status, 200, finishResponse.text)

    const saveAfterFinishResponse = await agent.post(`/api/sessions/${sessionId}/save-to-program`)
    assert.equal(saveAfterFinishResponse.status, 409, saveAfterFinishResponse.text)
    assert.equal(saveAfterFinishResponse.body.error, 'Finished workouts cannot be saved to a program')
  } finally {
    await prisma.user.deleteMany({ where: { email } })
  }
})

test('a workout without a source program day is reported instead of creating a program', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const email = `save-unlinked-${suffix}@example.com`
  const agent = await registerAgent(email)

  try {
    const manualResponse = await agent.post('/api/sessions/manual').send({
      workoutDate: '2026-01-15',
      timezoneOffset: 0,
    })
    assert.equal(manualResponse.status, 201, manualResponse.text)
    const manualSessionId = manualResponse.body.session.id as string
    assert.equal(manualResponse.body.session.programId, null)
    assert.equal(manualResponse.body.session.dayId, null)

    const saveResponse = await agent.post(`/api/sessions/${manualSessionId}/save-to-program`)
    assert.equal(saveResponse.status, 409, saveResponse.text)
    assert.equal(saveResponse.body.error, 'This workout is not linked to a program day')

    const programsResponse = await agent.get('/api/programs')
    assert.equal(programsResponse.status, 200, programsResponse.text)
    assert.equal(programsResponse.body.programs.length, 1)
  } finally {
    await prisma.user.deleteMany({ where: { email } })
  }
})
