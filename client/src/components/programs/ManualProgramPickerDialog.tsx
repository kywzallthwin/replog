import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { getProgram, getPrograms, programQueryKey, programsQueryKey } from '../../lib/programs'
import { Dialog } from '../ui/Dialog'

type ManualProgramPickerDialogProps = {
  onClose: () => void
  onSelectWorkout: (dayId: string) => void
  isCreating: boolean
  createError: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
}

export function ManualProgramPickerDialog({
  onClose,
  onSelectWorkout,
  isCreating,
  createError,
  triggerRef,
}: ManualProgramPickerDialogProps) {
  const [step, setStep] = useState<'programs' | 'workouts'>('programs')
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const programButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const programsQuery = useQuery({ queryKey: programsQueryKey, queryFn: getPrograms, retry: false })
  const eligiblePrograms = useMemo(
    () => (programsQuery.data ?? []).filter((program) => program.dayCount > 0),
    [programsQuery.data],
  )
  const orderedPrograms = useMemo(
    () => [...eligiblePrograms].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    [eligiblePrograms],
  )
  const selectedProgram = orderedPrograms.find((program) => program.id === selectedProgramId)
  const selectedProgramQuery = useQuery({
    queryKey: programQueryKey(selectedProgramId ?? ''),
    queryFn: () => getProgram(selectedProgramId!),
    enabled: step === 'workouts' && Boolean(selectedProgramId),
    retry: false,
  })
  const getInitialFocusTarget = useCallback(() => {
    if (step === 'programs' && selectedProgramId) {
      return programButtonRefs.current.get(selectedProgramId) ?? headingRef.current
    }
    return headingRef.current
  }, [selectedProgramId, step])

  function close() {
    if (!isCreating) onClose()
  }

  function chooseProgram(programId: string) {
    if (isCreating) return
    setSelectedProgramId(programId)
    setStep('workouts')
  }

  function backToPrograms() {
    if (isCreating) return
    setStep('programs')
  }

  const title = step === 'programs' ? 'Choose Program' : 'Choose Workout'

  return (
    <Dialog
      labelledBy="manual-program-picker-title"
      onClose={close}
      closeOnEscape={!isCreating}
      getInitialFocusTarget={getInitialFocusTarget}
      restoreFocusRef={triggerRef}
      fallbackFocusRef={triggerRef}
      focusKey={step}
      overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-3 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6"
      className="flex max-h-[85dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_12px_50px_rgba(15,23,42,0.2)]"
    >
      <header className="shrink-0 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0 py-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">From Program</p>
          <h2 ref={headingRef} id="manual-program-picker-title" tabIndex={-1} className="mt-0.5 min-w-0 text-xl font-extrabold tracking-[-0.03em] text-slate-900 focus:outline-none">{step === 'programs' ? 'Choose a program' : 'Choose a workout'}</h2>
        </div>
      </header>

      {step === 'workouts' && selectedProgram ? (
        <button type="button" onClick={backToPrograms} disabled={isCreating} className="flex min-h-[56px] shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/20 disabled:opacity-50">
          <ArrowLeft aria-hidden="true" size={18} className="shrink-0 text-slate-500" />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 break-words text-base font-semibold leading-[22px] text-slate-800 [overflow-wrap:anywhere]">{selectedProgram.name}</span>
            {selectedProgram.isActive ? <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold leading-none text-slate-500">Active</span> : null}
          </span>
        </button>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        {step === 'programs' ? <div className="space-y-3">
          {programsQuery.isPending ? <p role="status" className="rounded-[14px] bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading programs…</p> : null}
          {programsQuery.isError ? <div className="rounded-[14px] bg-red-50 p-4"><p role="alert" className="text-sm text-red-700">Unable to load programs. Please try again.</p><button type="button" onClick={() => void programsQuery.refetch()} disabled={programsQuery.isFetching} className="mt-3 min-h-11 rounded-[11px] bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60">{programsQuery.isFetching ? 'Retrying…' : 'Retry'}</button></div> : null}
          {programsQuery.isSuccess && orderedPrograms.map((program) => (
            <button key={program.id} ref={(node) => { if (node) programButtonRefs.current.set(program.id, node); else programButtonRefs.current.delete(program.id) }} type="button" onClick={() => chooseProgram(program.id)} disabled={isCreating} className="flex min-h-[72px] w-full min-w-0 items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50">
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words text-base font-semibold leading-[22px] text-slate-900 [overflow-wrap:anywhere]">{program.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium leading-4 text-slate-500">
                  <span>{program.dayCount} {program.dayCount === 1 ? 'workout day' : 'workout days'}</span>
                  {program.isActive ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold leading-4 text-slate-500">Active</span> : null}
                </span>
              </span>
              <ChevronRight aria-hidden="true" size={19} className="shrink-0 text-slate-400" />
            </button>
          ))}
          {programsQuery.isSuccess && orderedPrograms.length === 0 ? <p className="rounded-[14px] bg-slate-50 px-4 py-4 text-sm text-slate-500">No programs with workouts available.</p> : null}
        </div> : null}

        {step === 'workouts' ? <div className="space-y-3">
          {programsQuery.isError ? <div className="rounded-[14px] bg-red-50 p-4"><p role="alert" className="text-sm text-red-700">Unable to verify this program. Please try again.</p><button type="button" onClick={() => void programsQuery.refetch()} disabled={programsQuery.isFetching || isCreating} className="mt-3 min-h-11 rounded-[11px] bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60">{programsQuery.isFetching ? 'Retrying…' : 'Retry'}</button></div> : null}
          {programsQuery.isSuccess && !selectedProgram ? <div className="rounded-[14px] bg-slate-50 p-4"><p className="text-sm text-slate-600">This program is no longer available.</p><button type="button" onClick={backToPrograms} disabled={isCreating} className="mt-3 min-h-11 rounded-[11px] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-50">Back to Choose Program</button></div> : null}
          {selectedProgram && selectedProgramQuery.isPending ? <p role="status" className="rounded-[14px] bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading workouts…</p> : null}
          {selectedProgram && selectedProgramQuery.isError ? <div className="rounded-[14px] bg-red-50 p-4"><p role="alert" className="text-sm text-red-700">Unable to load workouts. Please try again.</p><button type="button" onClick={() => void selectedProgramQuery.refetch()} disabled={selectedProgramQuery.isFetching || isCreating} className="mt-3 min-h-11 rounded-[11px] bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60">{selectedProgramQuery.isFetching ? 'Retrying…' : 'Retry'}</button></div> : null}
          {selectedProgram && selectedProgramQuery.isSuccess && (!selectedProgramQuery.data || selectedProgramQuery.data.days.length === 0) ? <div className="rounded-[14px] bg-slate-50 p-4"><p className="text-sm text-slate-600">This program has no workouts available.</p><button type="button" onClick={backToPrograms} disabled={isCreating} className="mt-3 min-h-11 rounded-[11px] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-50">Back to Choose Program</button></div> : null}
          {selectedProgramQuery.isSuccess && selectedProgramQuery.data?.days.map((day) => (
            <button key={day.id} type="button" onClick={() => onSelectWorkout(day.id)} disabled={isCreating} className="flex min-h-14 w-full min-w-0 items-center justify-between gap-3 rounded-[16px] border border-slate-100 bg-white px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-wait disabled:opacity-50">
              <span className="min-w-0 flex-1 line-clamp-2 break-words [overflow-wrap:anywhere]">{day.name}</span>
              <ChevronRight aria-hidden="true" size={19} className="shrink-0 text-slate-400" />
            </button>
          ))}
        </div> : null}
      </div>

      {createError ? <p role="alert" className="mx-4 mb-3 shrink-0 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 sm:mx-5">Unable to start a manual workout. Resume or discard the existing draft, then try again.</p> : null}
      <footer className="flex shrink-0 gap-3 border-t border-slate-100 p-4 sm:px-5">
        {step === 'workouts' ? <>
          <button type="button" onClick={backToPrograms} disabled={isCreating} className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50">Back</button>
          <button type="button" onClick={close} disabled={isCreating} className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50">{isCreating ? 'Opening workout…' : 'Cancel'}</button>
        </> : <button type="button" onClick={close} disabled={isCreating} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50">{isCreating ? 'Opening workout…' : 'Cancel'}</button>}
      </footer>
    </Dialog>
  )
}
