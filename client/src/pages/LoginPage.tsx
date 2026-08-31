import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthField } from '../components/auth/AuthField'
import { AuthShell } from '../components/auth/AuthShell'
import { GoogleButton } from '../components/auth/GoogleButton'
import { PasswordField } from '../components/auth/PasswordField'
import { getEmailError, getRequiredError } from '../components/auth/authValidation'
import { api } from '../lib/api'
import { authMeQueryKey, clearPrivateQueries, type AuthResponse } from '../lib/auth'

type ApiErrorResponse = {
  error?: string
}

type LoginFieldErrors = {
  email?: string
  password?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [error, setError] = useState(() => getGoogleError(searchParams.get('google_error')))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    clearPrivateQueries(queryClient)
  }, [queryClient])

  function validateForm() {
    const nextErrors: LoginFieldErrors = {
      email: getEmailError(email),
      password: getRequiredError(password, 'Password'),
    }

    setFieldErrors(nextErrors)

    if (nextErrors.email) {
      emailInputRef.current?.focus()
      return false
    }

    if (nextErrors.password) {
      passwordInputRef.current?.focus()
      return false
    }

    return true
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email: email.trim(),
        password,
      })

      clearPrivateQueries(queryClient)
      queryClient.setQueryData(authMeQueryKey, response.data.user)
      navigate('/dashboard')
    } catch (err) {
      if (axios.isAxiosError<ApiErrorResponse>(err)) {
        setError(err.response?.data?.error ?? 'Unable to log in')
        return
      }

      setError('Unable to log in')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="mb-7 flex rounded-2xl bg-slate-100 p-1.5">
        <NavLink
          to="/login"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
        >
          Login
        </NavLink>
        <NavLink
          to="/register"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        >
          Register
        </NavLink>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setFieldErrors((current) => ({ ...current, email: undefined }))
            setError('')
          }}
          onBlur={() => setFieldErrors((current) => ({ ...current, email: getEmailError(email) }))}
          required
          inputRef={emailInputRef}
          error={fieldErrors.email}
        />

        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setFieldErrors((current) => ({ ...current, password: undefined }))
            setError('')
          }}
          onBlur={() =>
            setFieldErrors((current) => ({
              ...current,
              password: getRequiredError(password, 'Password'),
            }))
          }
          required
          inputRef={passwordInputRef}
          error={fieldErrors.password}
        />

        <NavLink
          to="/forgot-password"
          className="-mt-2 mb-2 flex min-h-11 items-center justify-end text-sm font-semibold text-slate-900 transition hover:text-slate-600"
        >
          Forgot password?
        </NavLink>

        {error ? (
          <p role="alert" className="mb-4 rounded-[14px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mb-4 mt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {isSubmitting ? 'Logging in...' : `Login ${String.fromCharCode(0x2192)}`}
          </button>
        </div>
      </form>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="mb-5">
        <GoogleButton label="Continue with Google" />
      </div>

      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <NavLink to="/register" className="font-semibold text-slate-900">
          Register
        </NavLink>
      </p>
    </AuthShell>
  )
}

function getGoogleError(error: string | null) {
  switch (error) {
    case 'cancelled':
      return 'Google sign-in was cancelled.'
    case 'not_configured':
      return 'Google sign-in is not configured yet.'
    case 'invalid_state':
      return 'Google sign-in expired. Please try again.'
    case 'unverified_email':
      return 'Google sign-in requires a verified email address.'
    case 'account_conflict':
      return 'That Google account is linked to a different RepLog account.'
    case 'missing_code':
    case 'missing_identity':
    case 'provider_error':
      return 'Unable to sign in with Google. Please try again.'
    default:
      return ''
  }
}
