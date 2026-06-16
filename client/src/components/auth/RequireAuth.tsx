import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authMeQueryKey, getCurrentUser } from '../../lib/auth'

type RequireAuthProps = {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation()
  const { isError, isPending } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: getCurrentUser,
    retry: false,
  })

  if (isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-sm font-semibold text-slate-500">Loading RepLog...</p>
      </main>
    )
  }

  if (isError) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
