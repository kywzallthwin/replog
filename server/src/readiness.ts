export const READINESS_TIMEOUT_MS = 5000

type ReadinessQuery = () => Promise<unknown>

export async function isDatabaseReady(
  query: ReadinessQuery,
  timeoutMs = READINESS_TIMEOUT_MS,
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
  } catch {
    return false
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout)
    }
  }
}
