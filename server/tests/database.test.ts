/// <reference types="node" />
import assert from 'node:assert/strict'
import { after, test } from 'node:test'

process.env.NODE_ENV = 'test'

const { prisma } = await import('../src/prisma.js')

after(async () => {
  await prisma.$disconnect()
})

test('PostgreSQL enforces one unfinished session per user', async () => {
  const email = `database-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  let userId: string | undefined

  try {
    const user = await prisma.user.create({
      data: {
        email,
        username: 'Database Tester',
        avatarInitial: 'D',
      },
    })
    userId = user.id

    await prisma.session.create({
      data: {
        userId,
        dayNameSnapshot: 'TEST DAY',
        badgeColorSnapshot: 'neutral',
      },
    })

    await assert.rejects(
      prisma.session.create({
        data: {
          userId,
          dayNameSnapshot: 'TEST DAY',
          badgeColorSnapshot: 'neutral',
        },
      }),
      (error: unknown) => {
        return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
      },
    )
  } finally {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } })
    }
  }
})
