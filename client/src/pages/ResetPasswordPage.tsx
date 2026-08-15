import type { FormEvent } from 'react'
import { useState } from 'react'
import axios from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthShell } from '../components/auth/AuthShell'
import { resetPassword } from '../lib/auth'

type ApiErrorResponse = {
  error?: string
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!token) {
      setError('This password reset link is invalid or has expired')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      await resetPassword({ token, newPassword })
      setNewPassword('')
      setConfirmPassword('')
      setIsComplete(true)
    } catch (err) {
      if (axios.isAxiosError<ApiErrorResponse>(err)) {
        setError(err.response?.data?.error ?? 'Unable to update password')
      } else {
        setError('Unable to update password')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell tagline="Set a new password.">
      {isComplete ? (
        <div aria-live="polite">
          <h2 className="mb-2 text-xl font-bold text-slate-900">Password updated</h2>
          <p className="mb-5 text-sm leading-6 text-slate-500">
            Your password has been changed. Log in with your new password to continue.
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
          <h2 className="mb-2 text-xl font-bold text-slate-900">New password</h2>
          <p className="mb-5 text-sm leading-6 text-slate-500">
            Choose a new password for your account.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
                maxLength={128}
                autoFocus
                className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
              />
              <p className="mt-1 text-xs text-slate-400">Min. 8 characters</p>
            </div>

            <div className="mb-4">
              <label htmlFor="confirm-new-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirm New Password
              </label>
              <input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                maxLength={128}
                className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            {error ? (
              <div role="alert" className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                <p>{error}</p>
                <Link to="/forgot-password" className="mt-2 inline-block underline underline-offset-2">
                  Request a new link
                </Link>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Back to{' '}
            <Link to="/login" className="font-semibold text-slate-900">
              Login
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
