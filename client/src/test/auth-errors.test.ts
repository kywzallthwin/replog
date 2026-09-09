import axios from 'axios'
import { describe, expect, it } from 'vitest'
import { isUnauthenticatedError } from '../lib/authErrors'

function axiosError(status?: number) {
  const error = new axios.AxiosError('Request failed')
  if (status !== undefined) {
    error.response = { status } as typeof error.response
  }
  return error
}

describe('authentication error classification', () => {
  it('treats only an Axios 401 response as unauthenticated', () => {
    expect(isUnauthenticatedError(axiosError(401))).toBe(true)
    expect(isUnauthenticatedError(axiosError(403))).toBe(false)
    expect(isUnauthenticatedError(axiosError(500))).toBe(false)
    expect(isUnauthenticatedError(axiosError())).toBe(false)
    expect(isUnauthenticatedError(new Error('unexpected failure'))).toBe(false)
  })
})
