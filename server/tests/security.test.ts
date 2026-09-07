/// <reference types="node" />
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'

const { app } = await import('../src/index.js')
const { env, parseEnvironment } = await import('../src/env.js')
const {
  getAuthCookieOptions,
  getGoogleStateCookieOptions,
} = await import('../src/modules/auth/auth.tokens.js')
const { getPasswordResetUrl } = await import('../src/modules/auth/auth.routes.js')
const { prisma } = await import('../src/prisma.js')

after(async () => {
  await prisma.$disconnect()
})

type RateLimitResponse = {
  status: number
  text: string
}

async function assertRateLimited(
  send: (attempt: number) => Promise<RateLimitResponse>,
  allowedRequests: number,
  errorMessage: string,
) {
  for (let attempt = 0; attempt < allowedRequests; attempt += 1) {
    const response = await send(attempt)
    assert.notEqual(response.status, 429, `request ${attempt + 1} was unexpectedly rate limited: ${response.text}`)
  }

  const limitedResponse = await send(allowedRequests)
  assert.equal(limitedResponse.status, 429, limitedResponse.text)
  assert.match(limitedResponse.text, new RegExp(errorMessage))
}

test('production environment validation and auth cookies fail closed safely', () => {
  const baseEnvironment = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/replog',
    JWT_SECRET: 'replog-test-secret-at-least-16-characters',
    CLIENT_URL: 'http://localhost:5173',
  }

  assert.throws(
    () => parseEnvironment({ ...baseEnvironment, NODE_ENV: 'invalid' }),
    /Invalid server environment/,
  )
  assert.throws(
    () => parseEnvironment({ ...baseEnvironment, NODE_ENV: 'production' }),
    /Invalid server environment/,
  )
  assert.throws(
    () => parseEnvironment({
      ...baseEnvironment,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/replog?sslmode=require',
      DATABASE_URL_UNPOOLED: 'postgresql://postgres:postgres@localhost:5432/replog?sslmode=require',
      CLIENT_URL: 'https://replog.example',
      JWT_SECRET: 'short-production-secret',
    }),
    /Invalid server environment/,
  )

  const productionEnvironment = parseEnvironment({
    ...baseEnvironment,
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/replog?sslmode=require',
    DATABASE_URL_UNPOOLED: 'postgresql://postgres:postgres@localhost:5432/replog?sslmode=require',
    CLIENT_URL: 'https://replog.example/',
    GOOGLE_CALLBACK_URL: 'https://replog.example/api/auth/google/callback',
  })
  assert.equal(productionEnvironment.NODE_ENV, 'production')
  assert.equal(productionEnvironment.DATABASE_URL_UNPOOLED?.includes('sslmode=require'), true)
  assert.equal(productionEnvironment.CLIENT_URL, 'https://replog.example')

  assert.equal(getAuthCookieOptions(false).secure, false)
  assert.equal(getAuthCookieOptions(true).secure, true)
  assert.equal(getAuthCookieOptions(true).httpOnly, true)
  assert.equal(getAuthCookieOptions(true).sameSite, 'none')
  assert.equal(getAuthCookieOptions(true).path, '/')
  assert.equal(getGoogleStateCookieOptions(true).sameSite, 'none')
  assert.equal(getGoogleStateCookieOptions(true).secure, true)
  assert.equal(getGoogleStateCookieOptions(true).httpOnly, true)
  assert.equal(getGoogleStateCookieOptions(true).path, '/api/auth/google')
  assert.equal(env.NODE_ENV, 'test')
})

test('credentialed CORS allows only the canonical frontend and safe development origins', async () => {
  const allowedOriginResponse = await request(app)
    .options('/api/auth/login')
    .set('Origin', env.CLIENT_URL)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type')

  assert.equal(allowedOriginResponse.status, 204, allowedOriginResponse.text)
  assert.equal(allowedOriginResponse.headers['access-control-allow-origin'], env.CLIENT_URL)
  assert.equal(allowedOriginResponse.headers['access-control-allow-credentials'], 'true')

  const developmentOriginResponse = await request(app)
    .get('/health')
    .set('Origin', 'http://localhost:5173')

  assert.equal(developmentOriginResponse.status, 200, developmentOriginResponse.text)
  assert.equal(developmentOriginResponse.headers['access-control-allow-origin'], 'http://localhost:5173')

  const rejectedOriginResponse = await request(app)
    .options('/api/auth/login')
    .set('Origin', 'https://attacker.example')
    .set('Access-Control-Request-Method', 'POST')

  assert.equal(rejectedOriginResponse.headers['access-control-allow-origin'], undefined)
  assert.equal(rejectedOriginResponse.headers['access-control-allow-credentials'], undefined)
})

test('security headers, API cache policy, and parser errors are safe JSON responses', async () => {
  assert.equal(app.get('trust proxy'), 1)

  const healthResponse = await request(app).get('/health')
  assert.equal(healthResponse.status, 200, healthResponse.text)
  assert.equal(healthResponse.headers['x-powered-by'], undefined)
  assert.equal(healthResponse.headers['x-content-type-options'], 'nosniff')
  assert.equal(healthResponse.headers['x-frame-options'], 'DENY')
  assert.equal(healthResponse.headers['referrer-policy'], 'no-referrer')
  assert.equal(healthResponse.headers['permissions-policy'], 'camera=(), geolocation=(), microphone=()')

  const notFoundResponse = await request(app).get('/api/not-a-route')
  assert.equal(notFoundResponse.status, 404, notFoundResponse.text)
  assert.deepEqual(notFoundResponse.body, { error: 'API route not found' })
  assert.equal(notFoundResponse.headers['cache-control'], 'no-store')
  assert.equal(notFoundResponse.headers.pragma, 'no-cache')
  assert.equal(notFoundResponse.headers.expires, '0')

  const malformedJsonResponse = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', '198.51.100.80')
    .set('Content-Type', 'application/json')
    .send('{"email":')
  assert.equal(malformedJsonResponse.status, 400, malformedJsonResponse.text)
  assert.deepEqual(malformedJsonResponse.body, { error: 'Invalid JSON request body' })
  assert.doesNotMatch(malformedJsonResponse.text, /SyntaxError|stack|at .*\(/)

  const oversizedJsonResponse = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', '198.51.100.81')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ payload: 'x'.repeat(100 * 1024) }))
  assert.equal(oversizedJsonResponse.status, 413, oversizedJsonResponse.text)
  assert.deepEqual(oversizedJsonResponse.body, { error: 'Request body too large' })
})

test('unsafe requests with auth cookies require an allowed origin or Fetch Metadata', async () => {
  const email = `security-origin-${Date.now()}@example.com`
  const agent = request.agent(app)
  const clientOrigin = env.CLIENT_URL

  try {
    const registerResponse = await agent
      .post('/api/auth/register')
      .set('X-Forwarded-For', '198.51.100.82')
      .send({ email, username: 'Origin Tester', password: 'password123' })
    assert.equal(registerResponse.status, 201, registerResponse.text)
    const authCookieHeader = registerResponse.headers['set-cookie']
    assert.match(Array.isArray(authCookieHeader) ? authCookieHeader.join('\n') : authCookieHeader ?? '', /replog_token=.*Path=\/.*HttpOnly; SameSite=Lax/)

    const invalidOriginResponse = await agent
      .post('/api/auth/logout')
      .set('Origin', 'https://attacker.example')
    assert.equal(invalidOriginResponse.status, 403, invalidOriginResponse.text)
    assert.deepEqual(invalidOriginResponse.body, { error: 'Request origin is not allowed' })

    const invalidFetchMetadataResponse = await agent
      .post('/api/auth/logout')
      .set('Sec-Fetch-Site', 'cross-site')
    assert.equal(invalidFetchMetadataResponse.status, 403, invalidFetchMetadataResponse.text)

    const allowedOriginResponse = await agent
      .post('/api/auth/logout')
      .set('Origin', clientOrigin)
    assert.equal(allowedOriginResponse.status, 204, allowedOriginResponse.text)

    const crossSiteAllowedOriginResponse = await agent
      .post('/api/auth/login')
      .set('Origin', clientOrigin)
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ email, password: 'password123' })
    assert.equal(crossSiteAllowedOriginResponse.status, 200, crossSiteAllowedOriginResponse.text)

    const loginResponse = await agent.post('/api/auth/login').send({ email, password: 'password123' })
    assert.equal(loginResponse.status, 200, loginResponse.text)
    const allowedFetchMetadataResponse = await agent
      .post('/api/auth/logout')
      .set('Sec-Fetch-Site', 'same-origin')
    assert.equal(allowedFetchMetadataResponse.status, 204, allowedFetchMetadataResponse.text)

    const clearCookieHeader = allowedFetchMetadataResponse.headers['set-cookie']
    assert.match(Array.isArray(clearCookieHeader) ? clearCookieHeader.join('\n') : clearCookieHeader ?? '', /replog_token=.*Path=\/.*Expires=.*HttpOnly; SameSite=Lax/)
  } finally {
    await prisma.user.deleteMany({ where: { email } })
  }
})

test('Google and password-reset redirects use the canonical frontend origin', async () => {
  const googleResponse = await request(app).get('/api/auth/google')
  assert.equal(googleResponse.status, 302, googleResponse.text)
  assert.equal(googleResponse.headers.location, `${env.CLIENT_URL}/login?google_error=not_configured`)

  assert.equal(getPasswordResetUrl('reset-token'), `${env.CLIENT_URL}/reset-password?token=reset-token`)
})

test('auth endpoints rate limit registration, login, OAuth, and password recovery', async () => {
  await assertRateLimited(
    (attempt) =>
      request(app)
        .post('/api/auth/register')
        .set('X-Forwarded-For', '198.51.100.83')
        .send({ email: `invalid-${attempt}@example.com` }),
    5,
    'Too many registration attempts',
  )

  await assertRateLimited(
    () =>
      request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '198.51.100.84')
        .send({}),
    10,
    'Too many login attempts',
  )

  await assertRateLimited(
    () => request(app).get('/api/auth/google').set('X-Forwarded-For', '198.51.100.85'),
    10,
    'Too many OAuth attempts',
  )

  await assertRateLimited(
    () =>
      request(app)
        .post('/api/auth/forgot-password')
        .set('X-Forwarded-For', '198.51.100.86')
        .send({ email: 'unknown@example.com' }),
    5,
    'Too many reset requests',
  )

  await assertRateLimited(
    () =>
      request(app)
        .post('/api/auth/reset-password')
        .set('X-Forwarded-For', '198.51.100.87')
        .send({}),
    10,
    'Too many reset attempts',
  )
})

test('changing a password keeps the current session and invalidates other sessions', async () => {
  const email = `security-session-${Date.now()}@example.com`
  const currentAgent = request.agent(app)
  const otherAgent = request.agent(app)

  try {
    const registerResponse = await currentAgent
      .post('/api/auth/register')
      .set('X-Forwarded-For', '198.51.100.88')
      .send({ email, username: 'Session Tester', password: 'password123' })
    assert.equal(registerResponse.status, 201, registerResponse.text)

    const otherLoginResponse = await otherAgent
      .post('/api/auth/login')
      .set('X-Forwarded-For', '198.51.100.89')
      .send({ email, password: 'password123' })
    assert.equal(otherLoginResponse.status, 200, otherLoginResponse.text)

    const changeResponse = await currentAgent
      .post('/api/users/me/password')
      .set('Origin', env.CLIENT_URL)
      .send({ currentPassword: 'password123', newPassword: 'new-password123' })
    assert.equal(changeResponse.status, 204, changeResponse.text)
    const setCookieHeader = changeResponse.headers['set-cookie']
    assert.match(Array.isArray(setCookieHeader) ? setCookieHeader.join('\n') : setCookieHeader ?? '', /replog_token=/)

    const currentSessionResponse = await currentAgent.get('/api/auth/me')
    assert.equal(currentSessionResponse.status, 200, currentSessionResponse.text)

    const otherSessionResponse = await otherAgent.get('/api/auth/me')
    assert.equal(otherSessionResponse.status, 401, otherSessionResponse.text)
  } finally {
    await prisma.user.deleteMany({ where: { email } })
  }
})
