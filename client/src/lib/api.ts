import axios from 'axios'

function addApiPath(url: string) {
  const normalizedUrl = url.trim().replace(/\/+$/, '')
  const apiUrl = normalizedUrl.replace(/(?:\/api)+$/i, '/api')
  return apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`
}

export function resolveApiBaseUrl(
  configuredApiUrl: string | undefined,
  isProduction: boolean,
  browserApiOrigin?: string,
) {
  if (configuredApiUrl?.trim()) {
    return addApiPath(configuredApiUrl)
  }

  if (isProduction) {
    return '/api'
  }

  return browserApiOrigin ? addApiPath(browserApiOrigin) : 'http://localhost:4000/api'
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
