/// <reference types="node" />
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDatabaseReady } from '../src/readiness.js'

test('database readiness returns false when the probe exceeds its deadline', async () => {
  const startedAt = Date.now()
  const ready = await isDatabaseReady(() => new Promise(() => {}), 10)

  assert.equal(ready, false)
  assert.ok(Date.now() - startedAt < 1000)
})

test('database readiness returns false when the probe fails', async () => {
  const ready = await isDatabaseReady(async () => {
    throw new Error('database unavailable')
  })

  assert.equal(ready, false)
})

test('database readiness returns true when the probe succeeds', async () => {
  const ready = await isDatabaseReady(async () => undefined)

  assert.equal(ready, true)
})
