import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './env.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js'
import { exercisesRouter } from './modules/exercises/exercises.routes.js'
import { programsRouter } from './modules/programs/programs.routes.js'
import { progressRouter } from './modules/progress/progress.routes.js'
import { sessionsRouter } from './modules/sessions/sessions.routes.js'
import { usersRouter } from './modules/users/users.routes.js'
import { prisma } from './prisma.js'

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map(Number)

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false
  }

  const [first, second] = octets

  if (first === undefined || second === undefined) {
    return false
  }

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isAllowedDevelopmentOrigin(origin: string) {
  try {
    const url = new URL(origin)
    const hostname = url.hostname.toLowerCase()

    if (url.protocol !== 'http:' || url.port !== '5173') {
      return false
    }

    return hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || isPrivateIpv4(hostname)
  } catch {
    return false
  }
}

function getDefaultClientDistPath() {
  const currentDirectory = dirname(fileURLToPath(import.meta.url))
  const sourcePath = resolve(currentDirectory, '../../client/dist')
  const compiledPath = resolve(currentDirectory, '../../../client/dist')

  return existsSync(compiledPath) ? compiledPath : sourcePath
}

export type AppOptions = {
  serveClient?: boolean
  clientDistPath?: string
}

export function createApp({
  serveClient = process.env.NODE_ENV === 'production',
  clientDistPath = getDefaultClientDistPath(),
}: AppOptions = {}) {
  const app = express()

  app.use(
    cors({
      origin: (origin, callback) => {
        const isAllowed =
          !origin ||
          origin === env.CLIENT_URL ||
          (process.env.NODE_ENV !== 'production' && isAllowedDevelopmentOrigin(origin))

        callback(null, isAllowed)
      },
      credentials: true,
    }),
  )
  app.use(express.json())
  app.use(cookieParser())

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ ok: true })
    } catch {
      res.status(503).json({ ok: false })
    }
  })

  app.use('/api/auth', authRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/exercises', exercisesRouter)
  app.use('/api/programs', programsRouter)
  app.use('/api/progress', progressRouter)
  app.use('/api/sessions', sessionsRouter)
  app.use('/api/users', usersRouter)

  // Keep unknown API requests out of the client fallback.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' })
  })

  if (serveClient) {
    app.use(express.static(clientDistPath, { index: false }))
    app.get(/^(?!\/api(?:\/|$)).*$/, (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }

      res.sendFile(join(clientDistPath, 'index.html'), (error) => {
        if (error) {
          next(error)
        }
      })
    })
  }

  return app
}

export const app = createApp()

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`)
  })
}
