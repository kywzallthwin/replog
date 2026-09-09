import axios from 'axios'

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

const browserApiOrigin = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : undefined

export const apiBaseUrl = resolveApiBaseUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.PROD,
  browserApiOrigin,
)

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
})
