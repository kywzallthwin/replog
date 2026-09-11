export const DEFAULT_READINESS_ATTEMPTS = 12
export const DEFAULT_READINESS_DELAY_MS = 5000
export const DEFAULT_READINESS_TIMEOUT_MS = 10000
export const DEFAULT_READINESS_MAX_WAIT_MS = 90000

type FetchLike = typeof fetch

export type ApiReadinessOptions = {
  apiBaseUrl: string
  attempts?: number
  delayMs?: number
  timeoutMs?: number
  maxWaitMs?: number
  now?: () => number
  signal?: AbortSignal
  fetchImpl?: FetchLike
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>
}

export function resolveApiReadinessUrl(apiBaseUrl: string) {
  const normalizedUrl = apiBaseUrl.trim().replace(/\/+$/, '')
  return normalizedUrl.replace(/\/api$/i, '') + '/ready'
}

function abortError() {
  return new DOMException('The readiness check was aborted', 'AbortError')
}

function timeoutError() {
  return new Error('API health check timed out')
}

function sleep(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(abortError())
  }

  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abortSleep)
      resolve()
    }
    const timeout = setTimeout(finish, delayMs)
    const abortSleep = () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abortSleep)
      reject(abortError())
    }
    signal?.addEventListener('abort', abortSleep, { once: true })
  })
}

async function checkApiHealth(
  url: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  fetchImpl: FetchLike,
) {
  const requestController = new AbortController()
  let didTimeout = false
  const timeout = setTimeout(() => {
    didTimeout = true
    requestController.abort()
  }, timeoutMs)
  const abortRequest = () => requestController.abort()
  signal?.addEventListener('abort', abortRequest, { once: true })

  try {
    const response = await fetchImpl(url, { signal: requestController.signal, cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`API health check returned ${response.status}`)
    }

    const body: unknown = await response.json()
    if (!body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
      throw new Error('API health check returned an invalid response')
    }
  } catch (error) {
    if (didTimeout) {
      throw timeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortRequest)
  }
}

export async function waitForApiReadiness({
  apiBaseUrl,
  attempts = DEFAULT_READINESS_ATTEMPTS,
  delayMs = DEFAULT_READINESS_DELAY_MS,
  timeoutMs = DEFAULT_READINESS_TIMEOUT_MS,
  maxWaitMs = DEFAULT_READINESS_MAX_WAIT_MS,
  now = () => performance.now(),
  signal,
  fetchImpl = fetch,
  sleep: sleepImpl = sleep,
}: ApiReadinessOptions) {
  const maxAttempts = Math.max(1, Math.floor(attempts))
  const deadline = now() + maxWaitMs
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts || deadline - now() > 0; attempt += 1) {
    if (signal?.aborted) {
      throw abortError()
    }

    const remainingMs = deadline - now()
    if (remainingMs <= 0) {
      throw new Error('API readiness check timed out')
    }

    try {
      await checkApiHealth(resolveApiReadinessUrl(apiBaseUrl), Math.min(timeoutMs, remainingMs), signal, fetchImpl)
      return
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error
      }
      lastError = error
    }

    if (deadline - now() > 0) {
      const delay = Math.min(delayMs, Math.max(0, deadline - now()))
      if (delay <= 0) {
        throw lastError ?? new Error('API readiness check timed out')
      }
      await sleepImpl(delay, signal)
    }
  }

  throw lastError ?? new Error('API readiness check failed')
}
