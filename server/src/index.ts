import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'

const app = express()
const port = 4000

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})