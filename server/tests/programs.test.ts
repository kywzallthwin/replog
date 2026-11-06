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
    const registerResponse = await agent.post('/api/auth/register').send({
      email,
      username: 'Program Tester',
      password: 'password123',
    })
    assert.equal(registerResponse.status, 201, registerResponse.text)

    const initialProgramsResponse = await agent.get('/api/programs')
    assert.equal(initialProgramsResponse.status, 200, initialProgramsResponse.text)
    assert.equal(initialProgramsResponse.body.programs.length, 1)
    assert.equal(initialProgramsResponse.body.programs[0].name, 'Beginner Full Body')

    const starterProgramId = initialProgramsResponse.body.programs[0].id as string
    const starterDetailsResponse = await agent.get(`/api/programs/${starterProgramId}`)
    assert.equal(starterDetailsResponse.status, 200, starterDetailsResponse.text)
    const starterDayId = starterDetailsResponse.body.program.days[0].id as string

    const templateResponse = await agent.post('/api/programs').send({
      name: 'Upper Lower Trial',
      source: 'template',
      templateId: 'upper-lower',
    })
    assert.equal(templateResponse.status, 201, templateResponse.text)
    const trialProgramId = templateResponse.body.program.id as string

    const activateResponse = await agent.post(`/api/programs/${trialProgramId}/activate`)
    assert.equal(activateResponse.status, 200, activateResponse.text)
    assert.equal(activateResponse.body.program.isActive, true)

    const inactiveStartResponse = await agent.post('/api/sessions').send({ dayId: starterDayId })
    assert.equal(inactiveStartResponse.status, 404, inactiveStartResponse.text)

    const copyResponse = await agent.post('/api/programs').send({
      name: 'Upper Lower Copy',
      source: 'copy',
      sourceProgramId: trialProgramId,
    })
    assert.equal(copyResponse.status, 201, copyResponse.text)
    const copyProgramId = copyResponse.body.program.id as string

    const renameResponse = await agent.patch(`/api/programs/${copyProgramId}`).send({ name: 'Upper Lower Copy Renamed' })
    assert.equal(renameResponse.status, 200, renameResponse.text)
    assert.equal(renameResponse.body.program.name, 'Upper Lower Copy Renamed')

    const deleteCopyResponse = await agent.delete(`/api/programs/${copyProgramId}`)
    assert.equal(deleteCopyResponse.status, 204, deleteCopyResponse.text)

    const trialDetailsResponse = await agent.get(`/api/programs/${trialProgramId}`)
    const trialDay = trialDetailsResponse.body.program.days[0]
    const sessionResponse = await agent.post('/api/sessions').send({ dayId: trialDay.id })
    assert.equal(sessionResponse.status, 201, sessionResponse.text)
    const sessionId = sessionResponse.body.session.id as string
    const sessionExercise = sessionResponse.body.session.exercises[0]
    const alternateExerciseId = trialDay.exercises[1].exerciseId as string

    const blockedSwitchResponse = await agent.post(`/api/programs/${starterProgramId}/activate`)
    assert.equal(blockedSwitchResponse.status, 409, blockedSwitchResponse.text)

    const addSetResponse = await agent.post(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets`).send({
      kind: 'NORMAL',
      notes: 'Last 2 reps had partial range.',
      weightKg: 20,
      reps: 8,
    })
    assert.equal(addSetResponse.status, 201, addSetResponse.text)
    assert.equal(addSetResponse.body.set.notes, 'Last 2 reps had partial range.')

    const chainResponse = await agent
      .post(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/batch`)
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
      .post(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/batch`)
      .send({
        parentSetId: addSetResponse.body.set.id,
        sets: [{ kind: 'DROP', weightKg: 17.5, reps: 5 }],
      })
    assert.equal(dropResponse.status, 201, dropResponse.text)
    assert.equal(dropResponse.body.sets[0].parentSetId, addSetResponse.body.set.id)

    const invalidRootKindResponse = await agent
      .patch(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/${addSetResponse.body.set.id}`)
      .send({ kind: 'DROP' })
    assert.equal(invalidRootKindResponse.status, 400, invalidRootKindResponse.text)

    const invalidDropKindResponse = await agent
      .patch(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/${dropResponse.body.sets[0].id}`)
      .send({ kind: 'NORMAL' })
    assert.equal(invalidDropKindResponse.status, 400, invalidDropKindResponse.text)

    const standaloneSetResponse = await agent
      .post(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets`)
      .send({ kind: 'NORMAL', weightKg: 10, reps: 10 })
    assert.equal(standaloneSetResponse.status, 201, standaloneSetResponse.text)

    const invalidStandaloneDropResponse = await agent
      .patch(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/${standaloneSetResponse.body.set.id}`)
      .send({ kind: 'DROP' })
    assert.equal(invalidStandaloneDropResponse.status, 400, invalidStandaloneDropResponse.text)

    const updateSetResponse = await agent
      .patch(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/${addSetResponse.body.set.id}`)
      .send({ notes: 'Full depth throughout.' })
    assert.equal(updateSetResponse.status, 200, updateSetResponse.text)
    assert.equal(updateSetResponse.body.set.notes, 'Full depth throughout.')

    const setDetailsResponse = await agent.get(`/api/sessions/${sessionId}`)
    assert.equal(setDetailsResponse.status, 200, setDetailsResponse.text)
    assert.equal(setDetailsResponse.body.session.exercises[0].sets[0].notes, 'Full depth throughout.')
    assert.equal(setDetailsResponse.body.session.exercises[0].sets.length, 6)

    const invalidSetNoteResponse = await agent
      .patch(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/${addSetResponse.body.set.id}`)
      .send({ notes: 'x'.repeat(301) })
    assert.equal(invalidSetNoteResponse.status, 400, invalidSetNoteResponse.text)

    const swapResponse = await agent
      .patch(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}`)
      .send({ exerciseId: alternateExerciseId })
    assert.equal(swapResponse.status, 409, swapResponse.text)

    const finishResponse = await agent.patch(`/api/sessions/${sessionId}/finish`)
    assert.equal(finishResponse.status, 200, finishResponse.text)

    const completedSetUpdateResponse = await agent
      .patch(`/api/sessions/${sessionId}/exercises/${sessionExercise.id}/sets/${addSetResponse.body.set.id}`)
      .send({ notes: 'Should be rejected.' })
    assert.equal(completedSetUpdateResponse.status, 409, completedSetUpdateResponse.text)

    const nextSessionResponse = await agent.post('/api/sessions').send({ dayId: trialDay.id })
    assert.equal(nextSessionResponse.status, 201, nextSessionResponse.text)
    const nextSessionId = nextSessionResponse.body.session.id as string
    const nextSessionDetailsResponse = await agent.get(`/api/sessions/${nextSessionId}`)
    assert.equal(nextSessionDetailsResponse.status, 200, nextSessionDetailsResponse.text)
    assert.deepEqual(nextSessionDetailsResponse.body.session.exercises[0].lastTime, {
      sessionId,
      performedAt: nextSessionDetailsResponse.body.session.exercises[0].lastTime.performedAt,
      weightKg: 20,
      reps: 8,
    })

    const cancelResponse = await agent.delete(`/api/sessions/${nextSessionId}`)
    assert.equal(cancelResponse.status, 204, cancelResponse.text)
  } finally {
    await prisma.user.deleteMany({ where: { email } })
  }
})

test('owners can reorder days within a program while preserving contents and rejecting invalid or unauthorized requests', async () => {
  const ownerEmail = `program-reorder-owner-${Date.now()}@example.com`
  const otherEmail = `program-reorder-other-${Date.now()}@example.com`
  const ownerAgent = request.agent(app)
  const otherAgent = request.agent(app)

  try {
    const ownerRegister = await ownerAgent.post('/api/auth/register').send({
      email: ownerEmail,
      username: 'Reorder Owner',
      password: 'password123',
    })
    assert.equal(ownerRegister.status, 201, ownerRegister.text)

    const otherRegister = await otherAgent.post('/api/auth/register').send({
      email: otherEmail,
      username: 'Other User',
      password: 'password123',
    })
    assert.equal(otherRegister.status, 201, otherRegister.text)

    const programsResponse = await ownerAgent.get('/api/programs')
    assert.equal(programsResponse.status, 200, programsResponse.text)
    const starterProgramId = programsResponse.body.programs[0].id as string

    const initialProgramResponse = await ownerAgent.get(`/api/programs/${starterProgramId}`)
    assert.equal(initialProgramResponse.status, 200, initialProgramResponse.text)
    const initialDays = initialProgramResponse.body.program.days as Array<{
      id: string
      name: string
      badgeColor: string
      order: number
      exercises: Array<{ id: string; exerciseId: string; name: string; order: number }>
    }>
    assert.equal(initialDays.length, 3)

    const [dayA, dayB, dayC] = initialDays
    assert.ok(dayA && dayB && dayC)

    // Move first day (index 0) to last position (index 2)
    const reorderResponse = await ownerAgent
      .patch(`/api/programs/${starterProgramId}/days/${dayA.id}/reorder`)
      .send({ targetIndex: 2 })
    assert.equal(reorderResponse.status, 200, reorderResponse.text)
    assert.deepEqual(
      reorderResponse.body.days.map((day: { id: string; name: string; badgeColor: string; order: number }) => ({
        id: day.id,
        name: day.name,
        badgeColor: day.badgeColor,
        order: day.order,
      })),
      [
        { id: dayB.id, name: dayB.name, badgeColor: dayB.badgeColor, order: 1 },
        { id: dayC.id, name: dayC.name, badgeColor: dayC.badgeColor, order: 2 },
        { id: dayA.id, name: dayA.name, badgeColor: dayA.badgeColor, order: 3 },
      ],
    )
    assert.deepEqual(reorderResponse.body.days[2].exercises, dayA.exercises)

    // Verify order persists across GET /api/programs/:programId and GET /api/programs/active
    const reloadedResponse = await ownerAgent.get(`/api/programs/${starterProgramId}`)
    assert.equal(reloadedResponse.status, 200, reloadedResponse.text)
    assert.deepEqual(
      reloadedResponse.body.program.days.map((day: { id: string; order: number }) => ({ id: day.id, order: day.order })),
      [
        { id: dayB.id, order: 1 },
        { id: dayC.id, order: 2 },
        { id: dayA.id, order: 3 },
      ],
    )
    assert.deepEqual(reloadedResponse.body.program.days[0].exercises, dayB.exercises)
    assert.deepEqual(reloadedResponse.body.program.days[1].exercises, dayC.exercises)
    assert.deepEqual(reloadedResponse.body.program.days[2].exercises, dayA.exercises)

    // Reorder via 'active' program alias (move dayC from index 1 to index 0)
    const reorderActiveAliasResponse = await ownerAgent
      .patch(`/api/programs/active/days/${dayC.id}/reorder`)
      .send({ targetIndex: 0 })
    assert.equal(reorderActiveAliasResponse.status, 200, reorderActiveAliasResponse.text)
    assert.deepEqual(
      reorderActiveAliasResponse.body.days.map((day: { id: string; order: number }) => ({ id: day.id, order: day.order })),
      [
        { id: dayC.id, order: 1 },
        { id: dayB.id, order: 2 },
        { id: dayA.id, order: 3 },
      ],
    )

    // Create a second program to test cross-program rejection
    const secondProgramResponse = await ownerAgent.post('/api/programs').send({
      name: 'Second Program',
      source: 'template',
      templateId: 'upper-lower',
    })
    assert.equal(secondProgramResponse.status, 201, secondProgramResponse.text)
    const secondProgramDayId = secondProgramResponse.body.program.days[0].id as string

    // Unauthenticated request -> 401
    const unauthResponse = await request(app)
      .patch(`/api/programs/${starterProgramId}/days/${dayA.id}/reorder`)
      .send({ targetIndex: 0 })
    assert.equal(unauthResponse.status, 401, unauthResponse.text)

    // Non-owner request -> 404
    const nonOwnerResponse = await otherAgent
      .patch(`/api/programs/${starterProgramId}/days/${dayA.id}/reorder`)
      .send({ targetIndex: 0 })
    assert.equal(nonOwnerResponse.status, 404, nonOwnerResponse.text)

    // Unknown program -> 404
    const unknownProgramResponse = await ownerAgent
      .patch(`/api/programs/unknown-program-id/days/${dayA.id}/reorder`)
      .send({ targetIndex: 0 })
    assert.equal(unknownProgramResponse.status, 404, unknownProgramResponse.text)

    // Unknown day -> 404
    const unknownDayResponse = await ownerAgent
      .patch(`/api/programs/${starterProgramId}/days/unknown-day-id/reorder`)
      .send({ targetIndex: 0 })
    assert.equal(unknownDayResponse.status, 404, unknownDayResponse.text)

    // Cross-program day -> 404
    const crossProgramDayResponse = await ownerAgent
      .patch(`/api/programs/${starterProgramId}/days/${secondProgramDayId}/reorder`)
      .send({ targetIndex: 0 })
    assert.equal(crossProgramDayResponse.status, 404, crossProgramDayResponse.text)

    // Negative targetIndex -> 400
    const negativeIndexResponse = await ownerAgent
      .patch(`/api/programs/${starterProgramId}/days/${dayA.id}/reorder`)
      .send({ targetIndex: -1 })
    assert.equal(negativeIndexResponse.status, 400, negativeIndexResponse.text)

    // Out-of-range targetIndex -> 400
    const outOfRangeIndexResponse = await ownerAgent
      .patch(`/api/programs/${starterProgramId}/days/${dayA.id}/reorder`)
      .send({ targetIndex: 3 })
    assert.equal(outOfRangeIndexResponse.status, 400, outOfRangeIndexResponse.text)
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
  }
})
