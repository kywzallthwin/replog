/// <reference types="node" />
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'

const { app, createApp } = await import('../src/index.js')
const { prisma } = await import('../src/prisma.js')

after(async () => {
  await prisma.$disconnect()
})

test('API routes use the /api namespace and readiness checks the database', async () => {
  const namespacedResponse = await request(app).get('/api/auth/me')
  assert.equal(namespacedResponse.status, 401, namespacedResponse.text)

  const unprefixedResponse = await request(app).get('/auth/me')
  assert.equal(unprefixedResponse.status, 404, unprefixedResponse.text)

  const readinessResponse = await request(app).get('/ready')
  assert.equal(readinessResponse.status, 200, readinessResponse.text)
  assert.deepEqual(readinessResponse.body, { ok: true })
})

test('health stays independent of database failures and readiness logs sanitized diagnostics', async () => {
  const transactionDescriptor = Object.getOwnPropertyDescriptor(prisma, '$transaction')
  Object.defineProperty(prisma, '$transaction', { configurable: true, value: async () => { throw new Error('postgres://user:password@host/db') } })
  const records: string[] = []
  const originalWarn = console.warn
  console.warn = (record?: unknown) => { records.push(String(record)) }
  try {
    const health = await request(app).get('/health')
    assert.equal(health.status, 200)
    assert.deepEqual(health.body, { ok: true })
    const ready = await request(app).get('/ready').set('X-Request-ID', 'trace/id-1')
    assert.equal(ready.status, 503)
    assert.deepEqual(ready.body, { ok: false, code: 'API_STARTING' })
    assert.equal(ready.headers['retry-after'], '5')
    const record = records[0]
    assert.ok(record)
    assert.match(record, /"requestId":"traceid-1"/)
    assert.match(record, /"category":"database_error"/)
    assert.match(record, /"durationMs":\d+/)
    assert.match(record, /"status":503/)
    assert.doesNotMatch(record, /password|postgres|host\/db/)
  } finally {
    console.warn = originalWarn
    if (transactionDescriptor) Object.defineProperty(prisma, '$transaction', transactionDescriptor)
    else Reflect.deleteProperty(prisma, '$transaction')
  }
})

test('production serving returns assets and SPA routes without masking API 404s', async () => {
  const clientDistPath = mkdtempSync(join(tmpdir(), 'replog-client-dist-'))
  writeFileSync(join(clientDistPath, 'index.html'), '<!doctype html><p>SPA fixture</p>')
  writeFileSync(join(clientDistPath, 'app.js'), 'asset fixture')

  try {
    const productionApp = createApp({ serveClient: true, clientDistPath })

    const assetResponse = await request(productionApp).get('/app.js')
    assert.equal(assetResponse.status, 200, assetResponse.text)
    assert.equal(assetResponse.text, 'asset fixture')

    const deepLinkResponse = await request(productionApp).get('/program/example')
    assert.equal(deepLinkResponse.status, 200, deepLinkResponse.text)
    assert.match(deepLinkResponse.text, /SPA fixture/)

    const apiResponse = await request(productionApp).get('/api/not-a-route')
    assert.equal(apiResponse.status, 404, apiResponse.text)
    assert.match(apiResponse.headers['content-type'] ?? '', /^application\/json/)
    assert.deepEqual(apiResponse.body, { error: 'API route not found' })
    assert.doesNotMatch(apiResponse.text, /SPA fixture/)
  } finally {
    rmSync(clientDistPath, { recursive: true, force: true })
  }
})
