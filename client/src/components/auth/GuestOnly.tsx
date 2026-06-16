import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { authMeQueryKey, getCurrentUser } from '../../lib/auth'

type GuestOnlyProps = {
  children: ReactNode
}

export function GuestOnly({ children }: GuestOnlyProps) {
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

  if (!isError) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
