export const DEFAULT_READINESS_ATTEMPTS = 6
export const DEFAULT_READINESS_DELAY_MS = 5000
export const DEFAULT_READINESS_TIMEOUT_MS = 10000

type FetchLike = typeof fetch

export type ApiReadinessOptions = {
  apiBaseUrl: string
  attempts?: number
  delayMs?: number
  timeoutMs?: number
  signal?: AbortSignal
  fetchImpl?: FetchLike
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>
}

export function resolveApiHealthUrl(apiBaseUrl: string) {
  const normalizedUrl = apiBaseUrl.trim().replace(/\/+$/, '')
  return normalizedUrl.replace(/\/api$/i, '') + '/health'
}

function abortError() {
  return new DOMException('The readiness check was aborted', 'AbortError')
}

function sleep(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(abortError())
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs)
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout)
      reject(abortError())
    }, { once: true })
  })
}

async function checkApiHealth(
  url: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  fetchImpl: FetchLike,
) {
  const requestController = new AbortController()
  const timeout = setTimeout(() => requestController.abort(), timeoutMs)
  const abortRequest = () => requestController.abort()
  signal?.addEventListener('abort', abortRequest, { once: true })

  try {
    const response = await fetchImpl(url, { signal: requestController.signal })
    if (!response.ok) {
      throw new Error(`API health check returned ${response.status}`)
    }

    const body: unknown = await response.json()
    if (!body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
      throw new Error('API health check returned an invalid response')
    }
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
  signal,
  fetchImpl = fetch,
  sleep: sleepImpl = sleep,
}: ApiReadinessOptions) {
  const maxAttempts = Math.max(1, Math.floor(attempts))
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw abortError()
    }

    try {
      await checkApiHealth(resolveApiHealthUrl(apiBaseUrl), timeoutMs, signal, fetchImpl)
      return
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error
      }
      lastError = error
    }

    if (attempt < maxAttempts) {
      await sleepImpl(delayMs, signal)
    }
  }

  throw lastError ?? new Error('API readiness check failed')
}
