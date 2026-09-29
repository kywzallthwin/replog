import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import net from 'node:net'

const apiHost = '127.0.0.1'
const apiPort = 4000
const clientPort = 5173
const serverHealthUrl = `http://${apiHost}:${apiPort}/health`
const serverReadyUrl = `http://${apiHost}:${apiPort}/ready`
const startupTimeoutMs = 15_000
const pollIntervalMs = 250
const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'

let serverProcess
let clientProcess
let shuttingDown = false
let exitCode = 0

function startProcess(name, args) {
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    detached: !isWindows,
    shell: isWindows,
    windowsHide: false,
  })

  child.once('error', (error) => {
    console.error(`[dev] Failed to start ${name}: ${error.message}`)
    if (!shuttingDown) {
      exitCode = 1
      void shutdown()
    }
  })

  return child
}

function stopProcess(child) {
  if (!child || child.exitCode !== null || child.killed) return

  if (isWindows) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch (error) {
      if (error.code !== 'ESRCH') child.kill('SIGTERM')
    }
  }
}

async function shutdown(code = exitCode) {
  if (shuttingDown) return
  shuttingDown = true
  stopProcess(clientProcess)
  stopProcess(serverProcess)
  exitCode = code
}

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: apiHost, port })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', (error) => {
      socket.destroy()
      if (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') resolve(false)
      else reject(error)
    })
  })
}

async function checkStartupPorts() {
  for (const port of [apiPort, clientPort]) {
    if (await checkPort(port)) {
      throw new Error(`Port ${port} is already in use. Stop the process using it before running npm run dev.`)
    }
  }
}

async function databaseEndpoint() {
  let configuredUrl = process.env.DATABASE_URL
  if (!configuredUrl) {
    try {
      const envFile = await readFile(new URL('../server/.env', import.meta.url), 'utf8')
      const match = envFile.match(/^\s*DATABASE_URL(?:_UNPOOLED)?\s*=\s*([^#\r\n]+)/m)
      configuredUrl = match?.[1]?.trim()
    } catch {
      // The server will report missing configuration if no .env is present.
    }
  }

  try {
    const url = new URL(configuredUrl || 'postgresql://localhost:5432')
    return `${url.hostname}:${url.port || 5432}`
  } catch {
    return 'configured PostgreSQL host and port'
  }
}

async function requestJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(pollIntervalMs) })
  let body = null
  try {
    body = await response.json()
  } catch {
    // Treat a non-JSON response as an unsuccessful probe.
  }
  return { response, body }
}

async function waitForServerHealth() {
  const deadline = Date.now() + startupTimeoutMs
  let healthSucceeded = false

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`API server exited during startup with code ${serverProcess.exitCode}`)
    }

    try {
      const health = await requestJson(serverHealthUrl)
      if (health.response.ok && health.body?.ok === true) {
        healthSucceeded = true
        const ready = await requestJson(serverReadyUrl)
        if (ready.response.ok && ready.body?.ok === true) return
      }
    } catch {
      // The API may still be starting or briefly restarting.
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  if (healthSucceeded) {
    throw new Error(`PostgreSQL is unavailable at ${await databaseEndpoint()}. Start PostgreSQL before running npm run dev.`)
  }
  throw new Error(`API failed to start: /health did not respond successfully within ${startupTimeoutMs / 1000} seconds`)
}

function handleChildExit(name, child, code, signal) {
  if (shuttingDown) return
  const status = signal ? `signal ${signal}` : `code ${code}`
  console.error(`[dev] ${name} exited unexpectedly with ${status}`)
  exitCode = code || 1
  if (child === serverProcess) clientProcess && stopProcess(clientProcess)
  if (child === clientProcess) stopProcess(serverProcess)
  void shutdown(exitCode)
}

process.once('SIGINT', () => void shutdown(130))
process.once('SIGTERM', () => void shutdown(143))

try {
  await checkStartupPorts()
  console.log('[dev] Starting API server...')
  serverProcess = startProcess('API server', ['run', 'dev', '-w', 'server'])
  serverProcess.once('exit', (code, signal) => handleChildExit('API server', serverProcess, code, signal))
  await waitForServerHealth()

  if (shuttingDown) process.exitCode = exitCode
  else {
    console.log('[dev] API health check passed; starting Vite...')
    clientProcess = startProcess('Vite client', ['run', 'dev', '-w', 'client'])
    clientProcess.once('exit', (code, signal) => handleChildExit('Vite client', clientProcess, code, signal))
    await new Promise((resolve) => {
      const check = () => (shuttingDown ? resolve() : setTimeout(check, 100))
      check()
    })
  }
} catch (error) {
  console.error(`[dev] ${error.message}`)
  exitCode = 1
  await shutdown(exitCode)
}

await new Promise((resolve) => setTimeout(resolve, 50))
process.exitCode = exitCode
