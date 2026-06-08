import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { env } from './env.js'
import { authRouter } from './modules/auth/auth.routes.js'

const app = express()

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

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`)
})
