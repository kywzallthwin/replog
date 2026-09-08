import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverRoot = join(root, 'server')
const temporarySchema = `replog_e2e_${Date.now()}_${process.pid}`

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
    const index = line.indexOf('=')
    return [line.slice(0, index), line.slice(index + 1)]
  }))
}

function databaseIdentity(value, name) {
  if (!value) throw new Error(`${name} is required to run browser tests`)
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
    throw new Error(`${name} must be a PostgreSQL connection URL with a database name`)
  }
  return `${url.hostname.toLowerCase()}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`
}

function commandFor(packageName, binaryName) {
  const packagePath = require.resolve(`${packageName}/package.json`)
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  return resolve(dirname(packagePath), packageJson.bin[binaryName || packageName])
}

function waitFor(url, label, timeout = 60_000) {
  const started = Date.now()
  return new Promise((resolvePromise, reject) => {
    const poll = async () => {
      try {
        const response = await fetch(url)
        if (response.ok) {
          resolvePromise()
          return
        }
      } catch {}
      if (Date.now() - started >= timeout) {
        reject(new Error(`Timed out waiting for ${label} at ${url}`))
        return
      }
      setTimeout(poll, 250)
    }
    poll()
  })
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
  else child.kill('SIGTERM')
}

const fileEnv = loadEnvFile(join(serverRoot, '.env'))
const environment = { ...fileEnv, ...process.env }
const developmentDatabase = databaseIdentity(environment.DATABASE_URL, 'DATABASE_URL')
const testDatabaseUrl = environment.TEST_DATABASE_URL
if (databaseIdentity(testDatabaseUrl, 'TEST_DATABASE_URL') === developmentDatabase) {
  throw new Error('DATABASE_URL and TEST_DATABASE_URL must point to different PostgreSQL databases')
}

const schemaUrl = new URL(testDatabaseUrl)
schemaUrl.searchParams.set('schema', temporarySchema)
const runtimeUrl = schemaUrl.toString()
const testEnvironment = {
  ...environment,
  NODE_ENV: 'test',
  DATABASE_URL: runtimeUrl,
  DATABASE_URL_UNPOOLED: runtimeUrl,
  JWT_SECRET: 'replog-e2e-secret-at-least-16-characters',
  CLIENT_URL: 'http://127.0.0.1:5173',
  PORT: '4000',
  DOTENV_CONFIG_PATH: join(root, 'missing-e2e.env'),
}
for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'RESEND_API_KEY']) delete testEnvironment[key]

const prisma = commandFor('prisma')
const playwright = commandFor('@playwright/test', 'playwright')
const tsx = require.resolve('tsx/cli')
const children = []
let status = 1

function run(command, args, options = {}) {
  return spawnSync(process.execPath, [command, ...args], { cwd: root, env: testEnvironment, stdio: 'inherit', ...options }).status ?? 1
}

try {
  status = run(prisma, ['migrate', 'deploy'], { cwd: serverRoot })
  if (status !== 0) throw new Error('Prisma migrations failed')
  const api = spawn(process.execPath, [tsx, 'src/index.ts'], { cwd: serverRoot, env: testEnvironment, stdio: 'inherit' })
  const client = spawn(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run dev -- --host 127.0.0.1'] : ['run', 'dev', '--', '--host', '127.0.0.1'], { cwd: join(root, 'client'), env: testEnvironment, stdio: 'inherit' })
  children.push(api, client)
  await waitFor('http://127.0.0.1:4000/ready', 'API')
  await waitFor('http://127.0.0.1:5173', 'client')
  status = run(playwright, ['test', ...(process.argv.includes('--headed') ? ['--headed'] : [])])
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
} finally {
  children.reverse().forEach(stopProcess)
  const cleanup = spawnSync(process.execPath, [prisma, 'db', 'execute', '--stdin'], { cwd: serverRoot, env: testEnvironment, input: `DROP SCHEMA IF EXISTS "${temporarySchema}" CASCADE;`, stdio: ['pipe', 'inherit', 'inherit'] })
  if (status === 0 && cleanup.status !== 0) status = cleanup.status ?? 1
}
process.exitCode = status
