export const READINESS_TIMEOUT_MS = 5000

type ReadinessQuery = () => Promise<unknown>
export type ReadinessFailure = { category: 'timeout' | 'database_error' }

export async function isDatabaseReady(
  query: ReadinessQuery,
  timeoutMs = READINESS_TIMEOUT_MS,
  onFailure?: (failure: ReadinessFailure) => void,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    await Promise.race([
      query(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Database readiness check timed out')), timeoutMs)
      }),
    ])
    return true
  } catch (error) {
    onFailure?.({ category: error instanceof Error && error.message === 'Database readiness check timed out' ? 'timeout' : 'database_error' })
    return false
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout)
    }
  }
}
