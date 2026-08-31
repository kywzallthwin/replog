import type { InputHTMLAttributes, ReactNode, RefObject } from 'react'

export type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string
  label: string
  error?: string
  hint?: ReactNode
  inputRef?: RefObject<HTMLInputElement | null>
  trailing?: ReactNode
}

export function AuthField({
  id,
  label,
  error,
  hint,
  inputRef,
  trailing,
  className,
  ...inputProps
}: AuthFieldProps) {
  const helperId = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div
        className={`group flex min-h-[54px] items-center rounded-[14px] border px-4 transition focus-within:ring-4 ${
          error
            ? 'border-red-300 bg-red-50/40 focus-within:border-red-500 focus-within:ring-red-500/10'
            : 'border-slate-200 bg-slate-50/70 focus-within:border-slate-900 focus-within:bg-white focus-within:ring-slate-900/5'
        }`}
      >
        <input
          {...inputProps}
          id={id}
          ref={inputRef}
          aria-invalid={Boolean(error)}
          aria-describedby={helperId}
          className={`auth-field-input min-w-0 flex-1 bg-transparent py-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`}
        />
        {trailing}
      </div>

      <div className="mt-1.5 min-h-4">
        {error ? (
          <p id={`${id}-error`} className="text-xs font-medium text-red-600">
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-xs text-slate-400">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}
