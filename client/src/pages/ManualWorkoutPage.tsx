import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, ChevronRight, Dumbbell, Plus, Trash2 } from 'lucide-react'
import { cancelSession, createManualSession, getManualDraft, manualDraftQueryKey, sessionQueryKey } from '../lib/sessions'
import { ManualProgramPickerDialog } from '../components/programs/ManualProgramPickerDialog'
import { Dialog } from '../components/ui/Dialog'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'
import { BrandLogo } from '../components/BrandLogo'

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function parseCalendarDate(value: string) {
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

function formatWorkoutDate(value: string, today: string) {
  const parsed = parseCalendarDate(value)
  if (!parsed) return 'Choose a valid date'
  if (value === today) return `Today, ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsed)}`
  const format = new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    ...(parsed.getFullYear() !== parseCalendarDate(today)?.getFullYear() ? { year: 'numeric' as const } : {}),
  })
  return format.format(parsed)
}

export function ManualWorkoutPage() {
  const [params, setParams] = useSearchParams()
  const [isProgramPickerOpen, setProgramPickerOpen] = useState(false)
  const [isDiscardDialogOpen, setDiscardDialogOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fromProgramButtonRef = useRef<HTMLButtonElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const discardButtonRef = useRef<HTMLButtonElement>(null)
  const keepDraftButtonRef = useRef<HTMLButtonElement>(null)
  const hasDateParam = params.has('date')
  const today = localDate()
  const date = hasDateParam ? (params.get('date') ?? '') : today
  const parsedDate = parseCalendarDate(date)
  const isDateValid = Boolean(parsedDate && date <= today)
  const draftQuery = useQuery({ queryKey: manualDraftQueryKey, queryFn: getManualDraft, retry: false })

  const createMutation = useMutation({
    mutationFn: (dayId?: string) => createManualSession({ dayId, workoutDate: date }),
    onSuccess: async (session) => {
      queryClient.setQueryData(sessionQueryKey(session.id), session)
      await queryClient.invalidateQueries({ queryKey: manualDraftQueryKey })
      navigate(`/workout/${session.id}?from=manual`)
    },
  })

  const discardMutation = useMutation({
    mutationFn: cancelSession,
    onSuccess: async (_result, sessionId) => {
      queryClient.removeQueries({ queryKey: sessionQueryKey(sessionId) })
      queryClient.setQueryData(manualDraftQueryKey, null)
      await queryClient.invalidateQueries({ queryKey: manualDraftQueryKey })
      setDiscardDialogOpen(false)
    },
  })

  function openDiscardDialog() {
    if (discardMutation.isPending || !draftQuery.data) return
    discardMutation.reset()
    setDiscardDialogOpen(true)
  }

  function closeDiscardDialog() {
    if (!discardMutation.isPending) setDiscardDialogOpen(false)
  }

  function discardManualDraft() {
    const sessionId = draftQuery.data?.id
    if (!sessionId || discardMutation.isPending) return
    discardMutation.mutate(sessionId)
  }

  function updateDate(workoutDate: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('date', workoutDate)
      return next
    }, { replace: true })
  }

  function startManualWorkout(dayId?: string) {
    if (!isDateValid || createMutation.isPending) return
    createMutation.mutate(dayId)
  }

  return (
    <main className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-slate-100 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/history')} aria-label="Back to History" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2">
            <ArrowLeft aria-hidden="true" size={20} strokeWidth={2.25} />
          </button>
          <Link to="/dashboard" aria-label="RepLog home" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2">
            <BrandLogo className="h-6 w-auto" />
          </Link>
          <TopNav />
        </header>
        <h1 className="mb-5 min-w-0 break-words text-3xl font-extrabold tracking-[-0.04em] text-slate-900 [overflow-wrap:anywhere]">Log Workout</h1>

        <>
          <div className="mb-5 min-w-0">
            <label htmlFor="manual-workout-date" className="mb-2 block text-sm font-bold text-slate-700">Workout date</label>
            <div onClick={(event) => {
              const input = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
              if (typeof input?.showPicker !== 'function') return
              try {
                input.showPicker()
                event.preventDefault()
              } catch {
                // Keep the native input's default activation as the fallback.
              }
            }} className="relative flex min-h-14 min-w-0 cursor-pointer items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-4 shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.995] active:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-900/20">
              <CalendarDays aria-hidden="true" size={19} className="shrink-0 text-slate-400" />
              <span aria-hidden="true" className={`min-w-0 flex-1 truncate font-semibold ${isDateValid ? 'text-slate-800' : 'text-red-600'}`}>{formatWorkoutDate(date, today)}</span>
              <span aria-hidden="true" className="shrink-0 text-sm font-bold text-slate-900">Change</span>
              <input ref={dateInputRef} id="manual-workout-date" aria-label="Workout date" aria-describedby={!isDateValid ? 'manual-workout-date-error' : undefined} type="date" max={today} value={parsedDate && date <= today ? date : ''} onChange={(event) => updateDate(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </div>
            {!isDateValid ? <p id="manual-workout-date-error" role="alert" className="mt-2 text-sm font-medium text-red-700">Choose a valid date no later than today.</p> : null}
          </div>
          {draftQuery.data ? <div className="mb-3 flex min-h-[68px] min-w-0 items-center gap-2 rounded-[18px] bg-white px-3 py-2 shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-slate-900/20 sm:px-4">
            <Link to={`/workout/${draftQuery.data.id}?from=manual`} className="flex min-h-11 min-w-0 flex-1 items-center rounded-[12px] px-2 text-left font-bold text-slate-900 focus-visible:outline-none">
              <span className="min-w-0 line-clamp-2 break-words [overflow-wrap:anywhere]">Resume draft</span>
            </Link>
            <button ref={discardButtonRef} type="button" data-press="icon" data-press-tone="red" aria-label="Discard manual workout draft" title="Discard manual workout draft" onClick={openDiscardDialog} disabled={discardMutation.isPending} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20 disabled:cursor-not-allowed disabled:text-red-300">
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div> : null}
          <button ref={fromProgramButtonRef} type="button" onClick={() => setProgramPickerOpen(true)} className="mb-3 flex min-h-[76px] w-full min-w-0 items-center gap-4 rounded-[18px] border border-slate-200 bg-white px-5 py-4 text-left font-extrabold text-slate-900 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-slate-100 text-slate-800"><Dumbbell aria-hidden="true" size={20} /></span><span className="min-w-0 flex-1">From Program</span><ChevronRight aria-hidden="true" size={20} className="shrink-0 text-slate-500" /></button>
          <button type="button" onClick={() => startManualWorkout()} disabled={!isDateValid || createMutation.isPending} className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[16px] border border-slate-200/80 bg-slate-50 px-5 py-3 text-left text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-wait disabled:opacity-60"><Plus aria-hidden="true" size={18} className="shrink-0 text-slate-400" /><span className="min-w-0 flex-1">Blank Workout</span><ChevronRight aria-hidden="true" size={18} className="shrink-0 text-slate-400" /></button>
        </>

        {createMutation.isError && !isProgramPickerOpen ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">Unable to start a manual workout. Resume or discard the existing draft, then try again.</p> : null}
      </div>
      {isProgramPickerOpen ? <ManualProgramPickerDialog
        onClose={() => setProgramPickerOpen(false)}
        onSelectWorkout={(dayId) => startManualWorkout(dayId)}
        isCreating={createMutation.isPending}
        createError={createMutation.isError}
        triggerRef={fromProgramButtonRef}
      /> : null}
      {isDiscardDialogOpen ? <Dialog
        role="alertdialog"
        labelledBy="manual-draft-discard-title"
        describedBy="manual-draft-discard-description"
        onClose={closeDiscardDialog}
        closeOnEscape={!discardMutation.isPending}
        initialFocusRef={keepDraftButtonRef}
        restoreFocusRef={discardButtonRef}
        fallbackFocusRef={fromProgramButtonRef}
        overlayClassName="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-6"
        className="max-h-[85dvh] w-full max-w-[380px] overflow-y-auto rounded-[22px] bg-white p-5 shadow-[0_12px_50px_rgba(15,23,42,0.2)]"
      >
        <h2 id="manual-draft-discard-title" className="min-w-0 break-words text-xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">Discard draft?</h2>
        <p id="manual-draft-discard-description" className="mt-2 text-sm leading-6 text-slate-500">This will delete your manually entered workout and sets.</p>
        {discardMutation.isError ? <p role="alert" className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Unable to discard draft. Please try again.</p> : null}
        <div className="mt-5 flex gap-2">
          <button ref={keepDraftButtonRef} type="button" onClick={closeDiscardDialog} disabled={discardMutation.isPending} className="min-h-11 flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-50">Keep draft</button>
          <button type="button" onClick={discardManualDraft} disabled={discardMutation.isPending} className="min-h-11 flex-1 rounded-[14px] border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20 disabled:cursor-wait disabled:opacity-50">{discardMutation.isPending ? 'Discarding…' : 'Discard draft'}</button>
        </div>
      </Dialog> : null}
      <BottomTabBar />
    </main>
  )
}
