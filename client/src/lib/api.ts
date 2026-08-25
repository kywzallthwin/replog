import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()

function getRuntimeApiUrl() {
  if (configuredApiUrl) {
    return configuredApiUrl
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`
  }

  return 'http://localhost:4000'
}

export const apiBaseUrl = getRuntimeApiUrl()

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
})
