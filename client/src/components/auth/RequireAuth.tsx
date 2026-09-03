import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authMeQueryKey, getCurrentUser } from '../../lib/auth'
import { BrandedLoader } from '../ui/BrandedLoader'

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
      <main className="min-h-dvh bg-slate-100 px-4">
        <BrandedLoader fullScreen statusMessage="Loading RepLog..." />
      </main>
    )
  }

  if (isError) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
