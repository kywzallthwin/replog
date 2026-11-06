import axios from 'axios'
import { installApiAvailability } from './apiAvailability'

function normalizeConfiguredApiUrl(configuredApiUrl: string, isProduction: boolean) {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(configuredApiUrl)
  } catch {
    throw new Error('VITE_API_URL must be an absolute HTTP(S) URL')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error('VITE_API_URL must be an HTTP(S) URL without credentials, query, or fragment')
  }
  if (isProduction && parsedUrl.protocol !== 'https:') {
    throw new Error('VITE_API_URL must use HTTPS in production')
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/, '').replace(/(?:\/api)+$/i, '') || ''
  parsedUrl.pathname = `${pathname}/api`
  return parsedUrl.toString().replace(/\/$/, '')
}

export function resolveApiBaseUrl(
  configuredApiUrl: string | undefined,
  isProduction: boolean,
  browserApiOrigin?: string,
) {
  if (configuredApiUrl?.trim()) {
    return normalizeConfiguredApiUrl(configuredApiUrl.trim(), isProduction)
  }

  if (isProduction) {
    return '/api'
  }

  return browserApiOrigin ? normalizeConfiguredApiUrl(browserApiOrigin, false) : 'http://localhost:4000/api'
}

const productionWakeUrl = 'https://replog-tracker.onrender.com/health'

export function resolveWakeUrl(configuredWakeUrl: string | undefined, isProduction: boolean) {
  const configured = configuredWakeUrl?.trim()
  if (configured) {
    try {
      const parsedUrl = new URL(configured)
      if (
        ['http:', 'https:'].includes(parsedUrl.protocol) &&
        (!isProduction || parsedUrl.protocol === 'https:') &&
        !parsedUrl.username &&
        !parsedUrl.password
      ) {
        return parsedUrl.toString()
      }
    } catch {
      return isProduction ? productionWakeUrl : undefined
    }
  }
  return isProduction ? productionWakeUrl : undefined
}

const browserApiOrigin = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : undefined

export let apiConfigurationError: Error | null = null
export let apiBaseUrl = '/api'

try {
  apiBaseUrl = resolveApiBaseUrl(
    import.meta.env.VITE_API_URL,
    import.meta.env.PROD,
    browserApiOrigin,
  )
} catch (error) {
  apiConfigurationError = error instanceof Error
    ? error
    : new Error('The API configuration is invalid')
}

export const apiWakeUrl = resolveWakeUrl(import.meta.env.VITE_API_WAKE_URL, import.meta.env.PROD)

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 30000,
})

installApiAvailability(api, () => apiBaseUrl, apiWakeUrl)
