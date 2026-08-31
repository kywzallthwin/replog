import { useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { AuthField, type AuthFieldProps } from './AuthField'

type PasswordFieldProps = Omit<AuthFieldProps, 'type' | 'trailing'>

export function PasswordField({ inputRef, label, ...props }: PasswordFieldProps) {
  const fallbackRef = useRef<HTMLInputElement>(null)
  const fieldRef = inputRef ?? fallbackRef
  const [isVisible, setIsVisible] = useState(false)

  function toggleVisibility() {
    const input = fieldRef.current
    const selectionStart = input?.selectionStart ?? null
    const selectionEnd = input?.selectionEnd ?? null

    setIsVisible((visible) => !visible)

    window.requestAnimationFrame(() => {
      input?.focus()

      if (selectionStart !== null && selectionEnd !== null) {
        input?.setSelectionRange(selectionStart, selectionEnd)
      }
    })
  }

  return (
    <AuthField
      {...props}
      label={label}
      inputRef={fieldRef}
      type={isVisible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          title={isVisible ? 'Hide password' : 'Show password'}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleVisibility}
          className="ml-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
        >
          {isVisible ? <EyeOff size={19} strokeWidth={2} /> : <Eye size={19} strokeWidth={2} />}
        </button>
      }
    />
  )
}
