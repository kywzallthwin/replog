import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type GenericAbortSignal } from 'axios'
import { waitForApiReadiness } from './apiReadiness'

const STALE_AFTER_MS = 10 * 60 * 1000

type AvailabilityConfig = AxiosRequestConfig & {
  __repLogReplay?: boolean
  __repLogAvailabilityChecked?: boolean
}

let lastSuccessfulAt: number | null = null
let readinessFlight: { promise: Promise<void>; controller: AbortController; waiters: number } | null = null

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function markApiAvailable() {
  lastSuccessfulAt = now()
}

export function resetApiAvailability() {
  lastSuccessfulAt = null
  readinessFlight?.controller.abort()
  readinessFlight = null
}

export function isApiAvailabilityStale() {
  return lastSuccessfulAt === null || now() - lastSuccessfulAt >= STALE_AFTER_MS
}

export function invalidateApiAvailability() {
  lastSuccessfulAt = null
}

function cancellationError() {
  return new axios.CanceledError('API availability check was canceled')
}

function waitWithCancellation(promise: Promise<void>, signal?: GenericAbortSignal) {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(cancellationError())

  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener?.('abort', abort)
      reject(cancellationError())
    }
    signal.addEventListener?.('abort', abort, { once: true })
    promise.then(
      () => {
        signal.removeEventListener?.('abort', abort)
        resolve()
      },
      (error: unknown) => {
        signal.removeEventListener?.('abort', abort)
        reject(error)
      },
    )
  })
}

export function ensureApiAvailable(getApiBaseUrl: () => string, signal?: GenericAbortSignal) {
  if (!isApiAvailabilityStale()) return Promise.resolve()
  if (!readinessFlight) {
    const controller = new AbortController()
    const flight = {
      controller,
      waiters: 0,
      promise: Promise.resolve(),
    }
    flight.promise = waitForApiReadiness({ apiBaseUrl: getApiBaseUrl(), signal: controller.signal }).then(() => {
      markApiAvailable()
    }).finally(() => {
      if (readinessFlight === flight) readinessFlight = null
    })
    readinessFlight = flight
  }

  const flight = readinessFlight
  flight.waiters += 1
  const result = waitWithCancellation(flight.promise, signal)
  return result.finally(() => {
    flight.waiters -= 1
    if (flight.waiters === 0 && readinessFlight === flight && !isApiAvailable()) {
      queueMicrotask(() => {
        if (flight.waiters === 0 && readinessFlight === flight && !isApiAvailable()) {
          flight.controller.abort()
        }
      })
    }
  })
}

function isApiAvailable() {
  return !isApiAvailabilityStale()
}

function methodOf(config: AxiosRequestConfig) {
  return (config.method ?? 'get').toUpperCase()
}

function isMutation(config: AxiosRequestConfig) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodOf(config))
}

function isSafeRequest(config: AxiosRequestConfig) {
  return ['GET', 'HEAD'].includes(methodOf(config))
}

function isRetryableFailure(error: AxiosError) {
  if (axios.isCancel(error) || error.code === AxiosError.ERR_CANCELED || error.config?.signal?.aborted) return false
  return !error.response || [502, 503, 504].includes(error.response.status)
}

export function installApiAvailability(instance: AxiosInstance, getApiBaseUrl: () => string) {
  instance.interceptors.request.use(async (config) => {
    const availabilityConfig = config as AvailabilityConfig
    if (isMutation(config) && !availabilityConfig.__repLogAvailabilityChecked) {
      availabilityConfig.__repLogAvailabilityChecked = true
      await ensureApiAvailable(getApiBaseUrl, config.signal)
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => {
      markApiAvailable()
      return response
    },
    async (error: AxiosError) => {
      const config = error.config as AvailabilityConfig | undefined
      if (!config || !isSafeRequest(config) || config.__repLogReplay || !isRetryableFailure(error)) {
        throw error
      }

      invalidateApiAvailability()
      await ensureApiAvailable(getApiBaseUrl, config.signal)
      config.__repLogReplay = true
      return instance.request(config)
    },
  )
}
