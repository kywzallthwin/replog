import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { NavLink, useNavigate } from 'react-router-dom'
import { AuthField } from '../components/auth/AuthField'
import { AuthShell } from '../components/auth/AuthShell'
import { GoogleButton } from '../components/auth/GoogleButton'
import { PasswordField } from '../components/auth/PasswordField'
import {
  getConfirmPasswordError,
  getEmailError,
  getPasswordError,
  getUsernameError,
} from '../components/auth/authValidation'
import { api } from '../lib/api'
import { authMeQueryKey, clearPrivateQueries, type AuthResponse } from '../lib/auth'

type ApiErrorResponse = {
  error?: string
}

type RegisterFieldErrors = {
  username?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({})
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const usernameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null)

  function validateForm() {
    const nextErrors: RegisterFieldErrors = {
      username: getUsernameError(username),
      email: getEmailError(email),
      password: getPasswordError(password),
      confirmPassword: getConfirmPasswordError(password, confirmPassword),
    }

    setFieldErrors(nextErrors)

    if (nextErrors.username) {
      usernameInputRef.current?.focus()
      return false
    }

    if (nextErrors.email) {
      emailInputRef.current?.focus()
      return false
    }

    if (nextErrors.password) {
      passwordInputRef.current?.focus()
      return false
    }

    if (nextErrors.confirmPassword) {
      confirmPasswordInputRef.current?.focus()
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
      const response = await api.post<AuthResponse>('/auth/register', {
        username: username.trim(),
        email: email.trim(),
        password,
      })

      clearPrivateQueries(queryClient)
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
      <div className="mb-7 flex rounded-2xl bg-slate-100 p-1.5">
        <NavLink
          to="/login"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        >
          Login
        </NavLink>
        <NavLink
          to="/register"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
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

      <form onSubmit={handleSubmit} noValidate>
        <AuthField
          id="register-username"
          label="Username"
          type="text"
          autoComplete="username"
          placeholder="john_lifts"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value)
            setFieldErrors((current) => ({ ...current, username: undefined }))
            setError('')
          }}
          onBlur={() =>
            setFieldErrors((current) => ({ ...current, username: getUsernameError(username) }))
          }
          required
          minLength={2}
          maxLength={32}
          inputRef={usernameInputRef}
          error={fieldErrors.username}
        />

        <AuthField
          id="register-email"
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
          id="register-password"
          label="Password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setFieldErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined }))
            setError('')
          }}
          onBlur={() => setFieldErrors((current) => ({ ...current, password: getPasswordError(password) }))}
          required
          minLength={8}
          maxLength={128}
          hint="At least 8 characters"
          inputRef={passwordInputRef}
          error={fieldErrors.password}
        />

        <PasswordField
          id="register-confirm-password"
          label="Confirm Password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value)
            setFieldErrors((current) => ({ ...current, confirmPassword: undefined }))
            setError('')
          }}
          onBlur={() =>
            setFieldErrors((current) => ({
              ...current,
              confirmPassword: getConfirmPasswordError(password, confirmPassword),
            }))
          }
          required
          minLength={8}
          maxLength={128}
          inputRef={confirmPasswordInputRef}
          error={fieldErrors.confirmPassword}
        />

        {error ? (
          <p role="alert" className="mb-4 rounded-[14px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
