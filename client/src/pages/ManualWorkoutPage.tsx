import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Dumbbell, Plus, Trash2 } from 'lucide-react'
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

export function ManualWorkoutPage() {
  const [params, setParams] = useSearchParams()
  const [isProgramPickerOpen, setProgramPickerOpen] = useState(false)
  const [isDiscardDialogOpen, setDiscardDialogOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fromProgramButtonRef = useRef<HTMLButtonElement>(null)
  const discardButtonRef = useRef<HTMLButtonElement>(null)
  const keepDraftButtonRef = useRef<HTMLButtonElement>(null)
  const date = params.get('date') || localDate()
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
      if (workoutDate) next.set('date', workoutDate)
      else next.delete('date')
      return next
    }, { replace: true })
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
          <label className="mb-5 block rounded-[18px] bg-white p-4 shadow-sm">
            <span className="mb-2 block text-sm font-bold text-slate-700">Workout date</span>
            <input aria-label="Workout date" type="date" max={localDate()} value={date} onChange={(event) => updateDate(event.target.value)} className="min-h-11 w-full rounded-[12px] border border-slate-200 px-3 font-semibold text-slate-800" />
          </label>
          {draftQuery.data ? <div className="mb-3 flex min-h-[68px] min-w-0 items-center gap-2 rounded-[18px] bg-white px-3 py-2 shadow-sm transition hover:shadow-md sm:px-4">
            <Link to={`/workout/${draftQuery.data.id}?from=manual`} className="flex min-h-11 min-w-0 flex-1 items-center rounded-[12px] px-2 text-left font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20">
              <span className="min-w-0 line-clamp-2 break-words [overflow-wrap:anywhere]">Resume draft</span>
            </Link>
            <button ref={discardButtonRef} type="button" data-press="icon" data-press-tone="red" aria-label="Discard manual workout draft" title="Discard manual workout draft" onClick={openDiscardDialog} disabled={discardMutation.isPending} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20 disabled:cursor-not-allowed disabled:text-red-300">
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div> : null}
          <button ref={fromProgramButtonRef} type="button" onClick={() => setProgramPickerOpen(true)} className="mb-3 flex min-h-[76px] w-full min-w-0 items-center gap-4 rounded-[18px] border border-slate-200 bg-white px-5 py-4 text-left font-extrabold text-slate-900 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-slate-100 text-slate-800"><Dumbbell aria-hidden="true" size={20} /></span><span className="min-w-0 flex-1">From Program</span><ChevronRight aria-hidden="true" size={20} className="shrink-0 text-slate-500" /></button>
          <button type="button" onClick={() => createMutation.mutate(undefined)} disabled={createMutation.isPending} className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[16px] border border-slate-200/80 bg-slate-50 px-5 py-3 text-left text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-wait disabled:opacity-60"><Plus aria-hidden="true" size={18} className="shrink-0 text-slate-400" /><span className="min-w-0 flex-1">Blank Workout</span><ChevronRight aria-hidden="true" size={18} className="shrink-0 text-slate-400" /></button>
        </>

        {createMutation.isError && !isProgramPickerOpen ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">Unable to start a manual workout. Resume or discard the existing draft, then try again.</p> : null}
      </div>
      {isProgramPickerOpen ? <ManualProgramPickerDialog
        onClose={() => setProgramPickerOpen(false)}
        onSelectWorkout={(dayId) => createMutation.mutate(dayId)}
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
