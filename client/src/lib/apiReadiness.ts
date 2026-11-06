import { wakeUpstream, type UpstreamWakeHandle } from './wakeUpstream'

export const DEFAULT_READINESS_ATTEMPTS = 12
export const DEFAULT_READINESS_DELAY_MS = 5000
export const DEFAULT_READINESS_TIMEOUT_MS = 15000
export const DEFAULT_READINESS_MAX_WAIT_MS = 90000

const READINESS_BACKOFF_MULTIPLIERS = [1, 1.6, 2] as const

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
  wakeUrl?: string
  wake?: (url: string) => UpstreamWakeHandle
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

class ReadinessError extends Error {
  readonly retryable: boolean
  readonly retryAfterMs: number
  readonly isGatewayStatus: boolean

  constructor(message: string, retryable: boolean, retryAfterMs = 0, isGatewayStatus = false) {
    super(message)
    this.name = 'ReadinessError'
    this.retryable = retryable
    this.retryAfterMs = retryAfterMs
    this.isGatewayStatus = isGatewayStatus
  }
}

function parseRetryAfterMs(headers: Headers | { get?: (name: string) => string | null | undefined } | undefined) {
  const headerValue = headers?.get?.('Retry-After') ?? headers?.get?.('retry-after')
  if (!headerValue) {
    return 0
  }
  const seconds = Number(headerValue.trim())
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0
  }
  return Math.ceil(seconds * 1000)
}

function resolveBackoffDelayMs(baseDelayMs: number, statusFailureCount: number) {
  const index = Math.min(Math.max(0, statusFailureCount - 1), READINESS_BACKOFF_MULTIPLIERS.length - 1)
  return Math.round(baseDelayMs * READINESS_BACKOFF_MULTIPLIERS[index])
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
      const retryable = [502, 503, 504].includes(response.status)
      throw new ReadinessError(
        `API health check returned ${response.status}`,
        retryable,
        retryable ? parseRetryAfterMs(response.headers) : 0,
        retryable,
      )
    }

    const body: unknown = await response.json()
    if (!body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
      throw new ReadinessError('API health check returned an invalid response', true)
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
  wakeUrl,
  wake = wakeUpstream,
}: ApiReadinessOptions) {
  const minimumAttempts = Math.max(1, Math.floor(attempts))
  const deadline = now() + maxWaitMs
  let lastError: unknown
  let statusFailureCount = 0
  const wakeHandles: UpstreamWakeHandle[] = []

  try {
    for (let attempt = 1; attempt <= minimumAttempts || now() < deadline; attempt += 1) {
      if (signal?.aborted) {
        throw abortError()
      }

      const remainingMs = deadline - now()
      if (remainingMs <= 0) {
        throw new Error('API readiness check timed out')
      }

      let nextDelayMs = delayMs
      try {
        await checkApiHealth(resolveApiReadinessUrl(apiBaseUrl), Math.min(timeoutMs, remainingMs), signal, fetchImpl)
        return
      } catch (error) {
        if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          throw error
        }
        if (error instanceof ReadinessError && !error.retryable) {
          throw error
        }
        if (wakeUrl) {
          wakeHandles.push(wake(wakeUrl))
        }
        if (error instanceof ReadinessError && error.isGatewayStatus) {
          statusFailureCount += 1
          const currentDelayMs = resolveBackoffDelayMs(delayMs, statusFailureCount)
          nextDelayMs = Math.max(currentDelayMs, error.retryAfterMs)
        }
        lastError = error
      }

      if (now() < deadline) {
        const delay = Math.min(nextDelayMs, Math.max(0, deadline - now()))
        if (delay <= 0) {
          throw lastError ?? new Error('API readiness check timed out')
        }
        await sleepImpl(delay, signal)
      }
    }

    throw lastError ?? new Error('API readiness check failed')
  } finally {
    for (const handle of wakeHandles) {
      handle.stop()
    }
  }
}
