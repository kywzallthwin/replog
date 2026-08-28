import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const testsRoot = join(serverRoot, 'tests')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'replog-test-'))
const emptyEnvFile = join(temporaryDirectory, 'empty.env')

writeFileSync(emptyEnvFile, '')

function getPostgresUrl(value, variableName) {
  if (!value) {
    throw new Error(`${variableName} is required to run PostgreSQL tests`)
  }

  let url

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL`)
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
    throw new Error(`${variableName} must be a PostgreSQL connection URL with a database name`)
  }

  return url
}

function getDatabaseIdentity(url) {
  const defaultPort = '5432'
  const databaseName = decodeURIComponent(url.pathname.slice(1))
  return `${url.hostname.toLowerCase()}:${url.port || defaultPort}/${databaseName}`
}

function discoverTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return discoverTests(path)
    }

    return entry.isFile() && entry.name.endsWith('.test.ts') ? [path] : []
  })
}

function run(command, args, environment, input) {
  const result = spawnSync(command, args, {
    cwd: serverRoot,
    env: environment,
    input,
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
  })

  if (result.error) {
    throw result.error
  }

  return result.status ?? 1
}

const tests = discoverTests(testsRoot).sort()

if (tests.length === 0) {
  throw new Error('No *.test.ts files were discovered under server/tests')
}

const developmentDatabaseUrl = getPostgresUrl(process.env.DATABASE_URL, 'DATABASE_URL')
const configuredTestDatabaseUrl = getPostgresUrl(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL')

if (getDatabaseIdentity(developmentDatabaseUrl) === getDatabaseIdentity(configuredTestDatabaseUrl)) {
  throw new Error('DATABASE_URL and TEST_DATABASE_URL must point to different PostgreSQL databases')
}

const testSchema = `replog_test_${Date.now()}_${process.pid}`
configuredTestDatabaseUrl.searchParams.set('schema', testSchema)
const testDatabaseUrl = configuredTestDatabaseUrl.toString()

const testEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl,
  DATABASE_URL_UNPOOLED: testDatabaseUrl,
  JWT_SECRET: 'replog-test-secret-at-least-16-characters',
  CLIENT_URL: 'http://127.0.0.1:5173',
  DOTENV_CONFIG_PATH: emptyEnvFile,
  DOTENV_CONFIG_QUIET: 'true',
}

for (const key of [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM',
]) {
  delete testEnvironment[key]
}

const prismaPackagePath = require.resolve('prisma/package.json')
const prismaPackage = JSON.parse(readFileSync(prismaPackagePath, 'utf8'))
const prismaCli = resolve(dirname(prismaPackagePath), prismaPackage.bin.prisma)
const tsxCli = require.resolve('tsx/cli')

let status = 1

try {
  status = run(process.execPath, [prismaCli, 'migrate', 'deploy'], testEnvironment)

  if (status === 0) {
    status = run(
      process.execPath,
      [tsxCli, '--test', '--test-concurrency=1', ...tests],
      testEnvironment,
    )
  }
} finally {
  const cleanupStatus = run(
    process.execPath,
    [prismaCli, 'db', 'execute', '--stdin'],
    testEnvironment,
    `DROP SCHEMA IF EXISTS "${testSchema}" CASCADE;`,
  )

  if (status === 0 && cleanupStatus !== 0) {
    status = cleanupStatus
  }

  rmSync(temporaryDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })
}

process.exitCode = status
