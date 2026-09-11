import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { authMeQueryKey, getCurrentUser } from '../../lib/auth'
import { isUnauthenticatedError } from '../../lib/authErrors'
import { BrandedLoader } from '../ui/BrandedLoader'

type GuestOnlyProps = {
  children: ReactNode
}

export function GuestOnly({ children }: GuestOnlyProps) {
  const { isError, isPending, refetch, isFetching, error } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: getCurrentUser,
    retry: false,
  })

  if (isPending) {
    return (
      <main className="min-h-dvh bg-slate-100 px-4">
        <BrandedLoader fullScreen statusMessage="Loading RepLog..." />
      </main>
    )
  }

  if (!isError) {
    return <Navigate to="/dashboard" replace />
  }

  if (!isUnauthenticatedError(error)) {
    return (
      <main className="grid min-h-dvh place-content-center bg-slate-100 px-6 text-center">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">The server is unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">Your session could not be checked. Try again.</p>
          <button type="button" className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </main>
    )
  }

  return children
}
