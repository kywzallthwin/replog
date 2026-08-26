import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()

function addApiPath(url: string) {
  const normalizedUrl = url.replace(/\/+$/, '')
  return normalizedUrl.endsWith('/api') ? normalizedUrl : `${normalizedUrl}/api`
}

function getRuntimeApiUrl() {
  if (configuredApiUrl) {
    return import.meta.env.PROD ? '/api' : addApiPath(configuredApiUrl)
  }

  if (typeof window !== 'undefined') {
    if (import.meta.env.PROD) {
      return '/api'
    }

    return addApiPath(`${window.location.protocol}//${window.location.hostname}:4000`)
  }

  return import.meta.env.PROD ? '/api' : 'http://localhost:4000/api'
}

export const apiBaseUrl = getRuntimeApiUrl()

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
})
