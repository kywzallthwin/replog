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

app.use(
  cors({
    origin: env.CLIENT_URL,
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
