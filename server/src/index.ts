import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { env } from './env.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js'
import { exercisesRouter } from './modules/exercises/exercises.routes.js'
import { programsRouter } from './modules/programs/programs.routes.js'
import { progressRouter } from './modules/progress/progress.routes.js'
import { sessionsRouter } from './modules/sessions/sessions.routes.js'
import { usersRouter } from './modules/users/users.routes.js'

export const app = express()

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

app.use('/auth', authRouter)
app.use('/dashboard', dashboardRouter)
app.use('/exercises', exercisesRouter)
app.use('/programs', programsRouter)
app.use('/progress', progressRouter)
app.use('/sessions', sessionsRouter)
app.use('/users', usersRouter)

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`)
  })
}
