import type { FormEvent } from 'react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { NavLink, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/auth/AuthShell'
import { GoogleButton } from '../components/auth/GoogleButton'
import { api } from '../lib/api'
import { authMeQueryKey, type AuthResponse } from '../lib/auth'

type ApiErrorResponse = {
  error?: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        username,
        email,
        password,
      })

      queryClient.setQueryData(authMeQueryKey, response.data.user)
      navigate('/dashboard')
    } catch (err) {
      if (axios.isAxiosError<ApiErrorResponse>(err)) {
        setError(err.response?.data?.error ?? 'Unable to create account')
        return
      }

      setError('Unable to create account')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="mb-5 flex rounded-[10px] bg-slate-100 p-1">
        <NavLink
          to="/login"
          className="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-slate-500"
        >
          Login
        </NavLink>
        <NavLink
          to="/register"
          className="flex-1 rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
        >
          Register
        </NavLink>
      </div>

      <div className="mb-4">
        <GoogleButton label="Sign up with Google" />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">
          or sign up with email
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Username
          </label>
          <input
            type="text"
            placeholder="john_lifts"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            minLength={2}
            maxLength={32}
            className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
          />
          <p className="mt-1 text-xs text-slate-400">Min. 8 characters</p>
        </div>

        {error ? (
          <p className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mb-5 mt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {isSubmitting
              ? 'Creating account...'
              : `Create Account ${String.fromCharCode(0x2192)}`}
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <NavLink to="/login" className="font-semibold text-slate-900">
          Login
        </NavLink>
      </p>
    </AuthShell>
  )
}
