/* eslint-disable react-refresh/only-export-components */
import { useRef } from 'react'
import { CalendarDays } from 'lucide-react'

export function getLocalCalendarDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(0)
  parsed.setFullYear(year, month - 1, day)
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null
  return parsed
}

export function isValidCalendarDate(value: string, maxDate: string) {
  return Boolean(parseCalendarDate(value) && value <= maxDate)
}

function formatWorkoutDate(value: string, today: string) {
  const parsed = parseCalendarDate(value)
  if (!parsed) return 'Choose a valid date'
  if (value === today) return `Today, ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsed)}`
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    ...(parsed.getFullYear() !== parseCalendarDate(today)?.getFullYear() ? { year: 'numeric' as const } : {}),
  }).format(parsed)
}

type ManualWorkoutDateFieldProps = {
  id: string
  value: string
  maxDate: string
  error?: string
  onChange: (value: string) => void
  onBlur?: () => void
}

export function ManualWorkoutDateField({ id, value, maxDate, error, onChange, onBlur }: ManualWorkoutDateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const parsedDate = parseCalendarDate(value)

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">Workout date</label>
      <div onClick={(event) => {
        const input = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
        if (typeof input?.showPicker !== 'function') return
        try {
          input.showPicker()
          event.preventDefault()
        } catch {
          // Keep the native input's default activation as the fallback.
        }
      }} className="relative flex min-h-14 min-w-0 cursor-pointer items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-4 shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.995] active:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-900/20">
        <CalendarDays aria-hidden="true" size={19} className="shrink-0 text-slate-400" />
        <span aria-hidden="true" className={`min-w-0 flex-1 truncate font-semibold ${!error ? 'text-slate-800' : 'text-red-600'}`}>{formatWorkoutDate(value, maxDate)}</span>
        <span aria-hidden="true" className="shrink-0 text-sm font-bold text-slate-900">Change</span>
        <input ref={inputRef} id={id} aria-label="Workout date" aria-invalid={Boolean(error) || undefined} aria-describedby={error ? `${id}-error` : undefined} type="date" max={maxDate} value={parsedDate && value <= maxDate ? value : ''} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </div>
      {error ? <p id={`${id}-error`} role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  )
}
