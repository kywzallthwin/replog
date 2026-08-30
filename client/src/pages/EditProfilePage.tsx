import type { FormEvent } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import {
  authMeQueryKey,
  getCurrentUser,
  updateCurrentUser,
  type AuthUser,
} from '../lib/auth'

type ApiErrorResponse = {
  error?: string
}

export function EditProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: getCurrentUser,
    retry: false,
  })
  const [username, setUsername] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState('')
  const updateMutation = useMutation({
    mutationFn: updateCurrentUser,
    onSuccess: (updatedUser: AuthUser) => {
      queryClient.setQueryData(authMeQueryKey, updatedUser)
      navigate('/profile')
    },
    onError: (err) => {
      if (axios.isAxiosError<ApiErrorResponse>(err)) {
        setError(err.response?.data?.error ?? 'Unable to update profile')
        return
      }

      setError('Unable to update profile')
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    updateMutation.mutate({ username: username ?? user?.username ?? '', email: email ?? user?.email ?? '' })
  }

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <Link to="/profile" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-900">
            Profile
          </Link>
          <h1 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <BrandLogo compact alt="" className="h-5 w-5" />
            Edit Profile
          </h1>
          <div className="w-12" />
        </header>

        <form onSubmit={handleSubmit} className="px-5 py-6">
          <div className="mb-7 flex flex-col items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 text-3xl font-extrabold tracking-[-0.02em] text-white">
              {user?.avatarInitial ?? 'U'}
            </div>
            <span className="mt-2 text-xs font-medium text-slate-500">Avatar initial updates from username</span>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Username</label>
            <input
              type="text"
              value={username ?? user?.username ?? ''}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={2}
              maxLength={32}
              className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email ?? user?.email ?? ''}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
            />
          </div>

          {error ? (
            <p className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            to="/profile"
            className="mt-3 block w-full rounded-[13px] border border-slate-200 bg-white px-5 py-[15px] text-center text-[15px] font-semibold text-slate-500 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
        </form>
      </div>
    </main>
  )
}
