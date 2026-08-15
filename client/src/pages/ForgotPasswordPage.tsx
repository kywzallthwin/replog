import type { FormEvent } from 'react'
import { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { AuthShell } from '../components/auth/AuthShell'
import { requestPasswordReset } from '../lib/auth'

type ApiErrorResponse = {
  error?: string
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await requestPasswordReset({ email })
      setIsSubmitted(true)
    } catch (err) {
      if (axios.isAxiosError<ApiErrorResponse>(err)) {
        setError(err.response?.data?.error ?? 'Unable to send reset link')
      } else {
        setError('Unable to send reset link')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell tagline="Reset your password.">
      {isSubmitted ? (
        <div aria-live="polite">
          <h2 className="mb-2 text-xl font-bold text-slate-900">Check your email</h2>
          <p className="mb-5 text-sm leading-6 text-slate-500">
            If an account exists for that email, we sent a password reset link. The link expires in one hour.
          </p>
          <Link
            to="/login"
            className="block w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-center text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800"
          >
            Back to Login
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mb-2 text-xl font-bold text-slate-900">Forgot password?</h2>
          <p className="mb-5 text-sm leading-6 text-slate-500">
            Enter your email and we&apos;ll send a reset link.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="forgot-password-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="forgot-password-email"
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
                className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            {error ? (
              <p role="alert" className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isSubmitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-slate-900">
              Back to Login
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
