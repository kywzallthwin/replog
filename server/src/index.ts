import cors from 'cors'
import cookieParser from 'cookie-parser'
import express, { type NextFunction, type Request, type Response } from 'express'
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
import {
  isAllowedOrigin,
  isApiPath,
  noStoreApiResponses,
  requireExpectedOrigin,
  securityHeaders,
} from './security.js'

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
  serveClient = env.NODE_ENV === 'production',
  clientDistPath = getDefaultClientDistPath(),
}: AppOptions = {}) {
  const app = express()

  app.disable('x-powered-by')
  // Render terminates TLS at one reverse-proxy hop. Trust that hop, not an arbitrary chain.
  app.set('trust proxy', 1)
  app.use(securityHeaders)
  app.use(
    cors({
      origin: (origin, callback) => {
        const isAllowed =
          !origin ||
          isAllowedOrigin(origin)

        callback(null, isAllowed)
      },
      credentials: true,
    }),
  )
  app.use(noStoreApiResponses)
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use(requireExpectedOrigin)

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

  app.use((_req, res) => {
    res.status(404).send('Not found')
  })

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error)
      return
    }

    const errorDetails =
      typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : undefined
    const status =
      typeof errorDetails?.status === 'number' && errorDetails.status >= 400 && errorDetails.status < 600
        ? errorDetails.status
        : typeof errorDetails?.statusCode === 'number' &&
            errorDetails.statusCode >= 400 &&
            errorDetails.statusCode < 600
          ? errorDetails.statusCode
          : 500
    const message =
      errorDetails?.type === 'entity.too.large'
        ? 'Request body too large'
        : errorDetails?.type === 'entity.parse.failed'
          ? 'Invalid JSON request body'
          : 'Internal server error'

    if (status >= 500) {
      console.error('Unhandled server error:', error instanceof Error ? error.message : 'Unknown error')
    }

    if (isApiPath(req.path)) {
      res.status(status).json({ error: message })
      return
    }

    res.status(status).send(message)
  })

  return app
}

export const app = createApp()

export let server: ReturnType<typeof app.listen> | undefined
let shutdownPromise: Promise<void> | undefined

async function closeServer() {
  const currentServer = server

  if (!currentServer) {
    return
  }

  await new Promise<void>((resolveClose, rejectClose) => {
    currentServer.close((error) => {
      if (error) {
        rejectClose(error)
        return
      }

      resolveClose()
    })
  })

  server = undefined
}

export function shutdown() {
  shutdownPromise ??= (async () => {
    try {
      await closeServer()
    } finally {
      await prisma.$disconnect()
    }
  })()

  return shutdownPromise
}

function handleShutdown(signal: 'SIGINT' | 'SIGTERM') {
  console.log(`Received ${signal}; shutting down gracefully`)
  void shutdown().catch((error: unknown) => {
    console.error('Graceful shutdown failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exitCode = 1
  })
}

if (env.NODE_ENV !== 'test') {
  server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${env.PORT}`)
  })

  process.once('SIGINT', () => handleShutdown('SIGINT'))
  process.once('SIGTERM', () => handleShutdown('SIGTERM'))
}
