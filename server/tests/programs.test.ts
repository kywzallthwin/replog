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
      weightKg: 20,
      reps: 8,
    })
    assert.equal(addSetResponse.status, 201, addSetResponse.text)

    const swapResponse = await agent
      .patch(`/sessions/${sessionId}/exercises/${sessionExercise.id}`)
      .send({ exerciseId: alternateExerciseId })
    assert.equal(swapResponse.status, 409, swapResponse.text)

    const cancelResponse = await agent.delete(`/sessions/${sessionId}`)
    assert.equal(cancelResponse.status, 204, cancelResponse.text)
  } finally {
    await prisma.user.deleteMany({ where: { email } })
  }
})
