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

test('user weightUnit defaults to KG, updates via PATCH /api/users/me, is isolated per user, and keeps server calculations in kg', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const emailA = `weight-unit-a-${suffix}@example.com`
  const emailB = `weight-unit-b-${suffix}@example.com`
  const agentA = request.agent(app)
  const agentB = request.agent(app)

  try {
    const registerA = await agentA.post('/api/auth/register').send({
      email: emailA,
      username: 'Lifter A',
      password: 'password123',
    })
    assert.equal(registerA.status, 201, registerA.text)
    assert.equal(registerA.body.user.weightUnit, 'KG')

    const registerB = await agentB.post('/api/auth/register').send({
      email: emailB,
      username: 'Lifter B',
      password: 'password123',
    })
    assert.equal(registerB.status, 201, registerB.text)
    assert.equal(registerB.body.user.weightUnit, 'KG')

    // /api/auth/me includes weightUnit
    const meInitial = await agentA.get('/api/auth/me')
    assert.equal(meInitial.status, 200, meInitial.text)
    assert.equal(meInitial.body.user.weightUnit, 'KG')

    // Update weightUnit only via PATCH /api/users/me
    const patchLb = await agentA.patch('/api/users/me').send({ weightUnit: 'LB' })
    assert.equal(patchLb.status, 200, patchLb.text)
    assert.equal(patchLb.body.user.weightUnit, 'LB')
    assert.equal(patchLb.body.user.username, 'Lifter A')
    assert.equal(patchLb.body.user.email, emailA)

    // Persists across /api/auth/me and login without affecting user B
    const meAfterLb = await agentA.get('/api/auth/me')
    assert.equal(meAfterLb.status, 200, meAfterLb.text)
    assert.equal(meAfterLb.body.user.weightUnit, 'LB')

    const meUserB = await agentB.get('/api/auth/me')
    assert.equal(meUserB.status, 200, meUserB.text)
    assert.equal(meUserB.body.user.weightUnit, 'KG')

    // Profile edit (username + email) preserves weightUnit when weightUnit is omitted
    const patchProfile = await agentA.patch('/api/users/me').send({
      username: 'Lifter A Updated',
      email: emailA,
    })
    assert.equal(patchProfile.status, 200, patchProfile.text)
    assert.equal(patchProfile.body.user.username, 'Lifter A Updated')
    assert.equal(patchProfile.body.user.weightUnit, 'LB')

    // Rejects invalid weightUnit or empty body
    const invalidUnit = await agentA.patch('/api/users/me').send({ weightUnit: 'STONE' })
    assert.equal(invalidUnit.status, 400, invalidUnit.text)

    const emptyPatch = await agentA.patch('/api/users/me').send({})
    assert.equal(emptyPatch.status, 400, emptyPatch.text)

    // Canonical SetLog.weightKg storage and server calculations remain in kilograms
    const dashboardInitial = await agentA.get('/api/dashboard')
    assert.equal(dashboardInitial.status, 200, dashboardInitial.text)
    const dayId = dashboardInitial.body.suggestedDay?.id as string
    assert.ok(dayId)

    const sessionRes = await agentA.post('/api/sessions').send({ dayId })
    assert.equal(sessionRes.status, 201, sessionRes.text)
    const sessionId = sessionRes.body.session.id as string
    const sessionExerciseId = sessionRes.body.session.exercises[0]?.id as string
    const exerciseId = sessionRes.body.session.exercises[0]?.exerciseId as string
    assert.ok(sessionExerciseId)
    assert.ok(exerciseId)

    const canonicalKg = 135 / 2.2046226218
    const addSetRes = await agentA
      .post(`/api/sessions/${sessionId}/exercises/${sessionExerciseId}/sets`)
      .send({
        kind: 'NORMAL',
        weightKg: canonicalKg,
        reps: 10,
      })
    assert.equal(addSetRes.status, 201, addSetRes.text)
    assert.ok(Math.abs(addSetRes.body.set.weightKg - canonicalKg) < 1e-9)

    const finishRes = await agentA.patch(`/api/sessions/${sessionId}/finish`)
    assert.equal(finishRes.status, 200, finishRes.text)

    const progressRes = await agentA.get(`/api/progress?exerciseId=${encodeURIComponent(exerciseId)}`)
    assert.equal(progressRes.status, 200, progressRes.text)
    assert.ok(Math.abs(progressRes.body.stats.heaviestWeightKg - canonicalKg) < 1e-9)
    assert.ok(
      Math.abs(progressRes.body.personalBest.estimatedOneRepMaxKg - canonicalKg * (1 + 10 / 30)) < 1e-9,
    )
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } })
  }
})
