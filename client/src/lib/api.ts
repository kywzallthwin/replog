import axios from 'axios'

export const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
})
