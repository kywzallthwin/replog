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
const databaseFile = join(temporaryDirectory, 'test.db')
const emptyEnvFile = join(temporaryDirectory, 'empty.env')

writeFileSync(emptyEnvFile, '')

function discoverTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return discoverTests(path)
    }

    return entry.isFile() && entry.name.endsWith('.test.ts') ? [path] : []
  })
}

function run(command, args, environment) {
  const result = spawnSync(command, args, {
    cwd: serverRoot,
    env: environment,
    stdio: 'inherit',
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

const testEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: `file:${databaseFile.replaceAll('\\', '/')}`,
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

let status

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
  rmSync(temporaryDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })
}

process.exitCode = status
