import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entryPoint = join(serverRoot, 'dist', 'src', 'index.js')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'replog-health-'))
const emptyEnvFile = join(temporaryDirectory, 'empty.env')

if (!existsSync(entryPoint)) {
  throw new Error('Compiled server entry point is missing. Run npm run build first.')
}

writeFileSync(emptyEnvFile, '')

function getAvailablePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()

    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()

      if (!address || typeof address === 'string') {
        probe.close()
        reject(new Error('Unable to allocate a local port'))
        return
      }

      probe.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolvePort(address.port)
      })
    })
  })
}

function waitForExit(child) {
  return new Promise((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }))
  })
}

async function requestHealth(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(1000) })
  const body = await response.json()

  if (response.status !== 200 || body.ok !== true) {
    throw new Error(`Unexpected health response: ${response.status} ${JSON.stringify(body)}`)
  }
}

const port = await getAvailablePort()
const childEnvironment = {
  ...process.env,
  NODE_ENV: 'ci',
  PORT: String(port),
  DATABASE_URL: 'postgresql://health:health@127.0.0.1:5432/replog_health?schema=public',
  JWT_SECRET: 'replog-health-secret-at-least-16-characters',
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
  delete childEnvironment[key]
}

const child = spawn(process.execPath, [entryPoint], {
  cwd: temporaryDirectory,
  env: childEnvironment,
  stdio: ['ignore', 'pipe', 'pipe'],
})
const childExit = waitForExit(child)

let output = ''
child.stdout.on('data', (chunk) => {
  output += chunk.toString()
})
child.stderr.on('data', (chunk) => {
  output += chunk.toString()
})

try {
  const deadline = Date.now() + 10000
  let lastError = new Error('Health endpoint did not respond')
  let healthy = false

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Compiled server exited with code ${child.exitCode}.\n${output}`)
    }

    try {
      await requestHealth(`http://127.0.0.1:${port}/health`)
      healthy = true
      break
    } catch (error) {
      lastError = error
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
    }
  }

  if (!healthy) {
    throw new Error(`${lastError.message}\n${output}`)
  }
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([
      childExit,
      new Promise((resolveExit) => setTimeout(resolveExit, 2000)),
    ])

    if (child.exitCode === null) {
      child.kill('SIGKILL')
      await childExit
    }
  }

  rmSync(temporaryDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })
}
