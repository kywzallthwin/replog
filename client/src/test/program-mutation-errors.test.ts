import axios from 'axios'
import { describe, expect, it } from 'vitest'
import { getProgramMutationError, isProgramConflict } from '../lib/programs'

describe('program mutation errors', () => {
  it('identifies duplicate exercise conflicts separately from other failures', () => {
    const conflict = new axios.AxiosError('Conflict')
    conflict.response = { status: 409 } as typeof conflict.response
    const failure = new Error('Network failure')

    expect(isProgramConflict(conflict)).toBe(true)
    expect(isProgramConflict(failure)).toBe(false)
    expect(getProgramMutationError(conflict, 'Already added', 'Try again')).toBe('Already added')
    expect(getProgramMutationError(failure, 'Already added', 'Try again')).toBe('Try again')
  })
})
