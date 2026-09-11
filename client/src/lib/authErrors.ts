import axios from 'axios'

export function isUnauthenticatedError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401
}
