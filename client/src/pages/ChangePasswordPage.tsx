import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { changePassword } from '../lib/auth'

type ApiErrorResponse = {
  error?: string
}

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const currentPasswordInputRef = useRef<HTMLInputElement>(null)
  const newPasswordInputRef = useRef<HTMLInputElement>(null)
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password updated. Use the new password next time you log in.')
    },
    onError: (err) => {
      if (axios.isAxiosError<ApiErrorResponse>(err)) {
        setError(err.response?.data?.error ?? 'Unable to update password')
        return
      }

      setError('Unable to update password')
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    passwordMutation.mutate({ currentPassword, newPassword })
  }

  function togglePasswordVisibility(
    input: HTMLInputElement | null,
    setIsShown: Dispatch<SetStateAction<boolean>>,
  ) {
    const selectionStart = input?.selectionStart ?? null
    const selectionEnd = input?.selectionEnd ?? null

    setIsShown((isShown) => !isShown)

    window.requestAnimationFrame(() => {
      input?.focus()

      if (selectionStart !== null && selectionEnd !== null) {
        input?.setSelectionRange(selectionStart, selectionEnd)
      }
    })
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <Link to="/profile" className="text-sm font-semibold text-slate-900">
            Profile
          </Link>
          <h1 className="text-[15px] font-bold text-slate-900">Change Password</h1>
          <div className="w-12" />
        </header>

        <form onSubmit={handleSubmit} className="px-5 py-6">
          <div className="mb-7 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-bold text-slate-600">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Current Password</label>
            <div className="relative">
              <input
                ref={currentPasswordInputRef}
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 pr-16 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
              />
              <button
                type="button"
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                aria-pressed={showCurrentPassword}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => togglePasswordVisibility(currentPasswordInputRef.current, setShowCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {showCurrentPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
            <div className="relative">
              <input
                ref={newPasswordInputRef}
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
                className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 pr-16 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
              />
              <button
                type="button"
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                aria-pressed={showNewPassword}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => togglePasswordVisibility(newPasswordInputRef.current, setShowNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {showNewPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Min. 8 characters</p>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm New Password</label>
            <div className="relative">
              <input
                ref={confirmPasswordInputRef}
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 pr-16 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                aria-pressed={showConfirmPassword}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => togglePasswordVisibility(confirmPasswordInputRef.current, setShowConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error ? (
            <p className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mb-4 rounded-[10px] bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={passwordMutation.isPending}
            className="w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
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
