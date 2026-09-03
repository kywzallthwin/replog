/// <reference types="node" />
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'

const { app } = await import('../src/index.js')
const { prisma } = await import('../src/prisma.js')
const { createProgramFromDays } = await import('../src/modules/programs/starterProgram.js')

after(async () => {
  await prisma.$disconnect()
})

test('dashboard Up Next selects only usable active-program days', async () => {
  const email = `dashboard-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const agent = request.agent(app)

  try {
    const registerResponse = await agent.post('/api/auth/register').send({
      email,
      username: 'Dashboard Tester',
      password: 'password123',
    })
    assert.equal(registerResponse.status, 201, registerResponse.text)
    const userId = registerResponse.body.user.id as string

    await prisma.program.deleteMany({ where: { ownerId: userId } })
    const activeProgram = await createProgramFromDays(
      prisma,
      userId,
      'Dashboard Test Program',
      [
        { name: 'EMPTY START', badgeColor: 'neutral', exercises: [] },
        { name: 'WORK A', badgeColor: 'blue', exercises: ['Bench Press'] },
        { name: 'EMPTY MIDDLE', badgeColor: 'neutral', exercises: [] },
        { name: 'WORK B', badgeColor: 'green', exercises: ['Squat'] },
      ],
      true,
    )
    const activeDays = await prisma.day.findMany({
      where: { programId: activeProgram.id },
      orderBy: { order: 'asc' },
    })
    const workA = activeDays.find((day) => day.name === 'WORK A')
    const workB = activeDays.find((day) => day.name === 'WORK B')
    assert.ok(workA)
    assert.ok(workB)

    async function getSuggestedDay() {
      const response = await agent.get('/api/dashboard')
      assert.equal(response.status, 200, response.text)
      return response.body.suggestedDay as { id: string; name: string } | null
    }

    async function createCompletedSession(
      programId: string,
      day: { id: string; name: string; badgeColor: string },
      startedAt: string,
    ) {
      return prisma.session.create({
        data: {
          userId,
          programId,
          programNameSnapshot: 'Dashboard Test Program',
          dayId: day.id,
          dayNameSnapshot: day.name,
          badgeColorSnapshot: day.badgeColor,
          startedAt: new Date(startedAt),
          endedAt: new Date(new Date(startedAt).getTime() + 45 * 60 * 1000),
          durationSec: 45 * 60,
        },
      })
    }

    assert.equal((await getSuggestedDay())?.id, workA.id)
    assert.equal((await getSuggestedDay())?.id, workA.id)

    await createCompletedSession(activeProgram.id, workA, '2026-01-01T10:00:00.000Z')
    assert.equal((await getSuggestedDay())?.id, workB.id)

    await createCompletedSession(activeProgram.id, workB, '2026-01-02T10:00:00.000Z')
    assert.equal((await getSuggestedDay())?.id, workA.id)

    await prisma.day.delete({ where: { id: workB.id } })
    assert.equal((await getSuggestedDay())?.id, workA.id)

    const otherProgram = await createProgramFromDays(
      prisma,
      userId,
      'Other Program',
      [{ name: 'OTHER DAY', badgeColor: 'purple', exercises: ['Plank'] }],
      false,
    )
    const otherDay = await prisma.day.findFirstOrThrow({ where: { programId: otherProgram.id } })
    await createCompletedSession(otherProgram.id, otherDay, '2026-01-03T10:00:00.000Z')
    assert.equal((await getSuggestedDay())?.id, workA.id)

    await prisma.dayExercise.deleteMany({ where: { dayId: workA.id } })
    assert.equal(await getSuggestedDay(), null)

    const finalDashboardResponse = await agent.get('/api/dashboard')
    assert.equal(finalDashboardResponse.status, 200, finalDashboardResponse.text)
    assert.equal(finalDashboardResponse.body.activeProgram.id, activeProgram.id)
    assert.ok(
      finalDashboardResponse.body.activeProgram.days.every(
        (day: { exerciseCount: number }) => day.exerciseCount === 0,
      ),
    )
  } finally {
    await prisma.user.deleteMany({ where: { email } })
  }
})
