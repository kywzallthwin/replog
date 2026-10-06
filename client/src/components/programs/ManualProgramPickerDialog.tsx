import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { getProgram, getPrograms, programQueryKey, programsQueryKey } from '../../lib/programs'
import { Dialog } from '../ui/Dialog'

type ManualProgramPickerDialogProps = {
  onClose: () => void
  onSelectWorkout: (dayId: string) => void
  isCreating: boolean
  createError: 'conflict' | 'request' | null
  onRefreshDraft: () => void
  isRefreshingDraft: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
}

type PickerRowProps = {
  name: string
  meta?: ReactNode
  onClick: () => void
  disabled: boolean
  minHeight: string
  buttonRef?: (node: HTMLButtonElement | null) => void
}

function PickerRow({ name, meta, onClick, disabled, minHeight, buttonRef }: PickerRowProps) {
  return (
    <button ref={buttonRef} type="button" onClick={onClick} disabled={disabled} className={`flex ${minHeight} w-full min-w-0 items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-5 py-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/20 disabled:cursor-wait disabled:opacity-50`}>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words text-base font-semibold leading-[22px] text-slate-900 [overflow-wrap:anywhere]">{name}</span>
        {meta ? <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium leading-4 text-slate-500">{meta}</span> : null}
      </span>
      <ChevronRight aria-hidden="true" size={19} className="shrink-0 text-slate-400" />
    </button>
  )
}

export function ManualProgramPickerDialog({
  onClose,
  onSelectWorkout,
  isCreating,
  createError,
  onRefreshDraft,
  isRefreshingDraft,
  triggerRef,
}: ManualProgramPickerDialogProps) {
  const [step, setStep] = useState<'programs' | 'workouts'>('programs')
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
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

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    list.scrollTop = 0
    if (step !== 'programs' || !selectedProgramId) return

    const selectedCard = programButtonRefs.current.get(selectedProgramId)
    if (!selectedCard) return

    const listBounds = list.getBoundingClientRect()
    const cardBounds = selectedCard.getBoundingClientRect()
    const cardTop = cardBounds.top - listBounds.top + list.scrollTop
    const cardBottom = cardTop + cardBounds.height

    if (cardTop < list.scrollTop) list.scrollTop = cardTop
    else if (cardBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = cardBottom - list.clientHeight
    }
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

  return (
    <Dialog
      labelledBy="manual-program-picker-title"
      onClose={close}
      closeOnEscape={!isCreating}
      getInitialFocusTarget={getInitialFocusTarget}
      restoreFocusRef={triggerRef}
      fallbackFocusRef={triggerRef}
      focusKey={step}
      preventScrollFocus
      overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-3 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6"
      className="flex h-[min(640px,85dvh)] max-h-full min-h-0 w-full max-w-[480px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_12px_50px_rgba(15,23,42,0.2)]"
    >
      <header className="shrink-0 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0 py-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">From Program</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <h2 ref={headingRef} id="manual-program-picker-title" tabIndex={-1} className="min-w-0 flex-1 text-xl font-extrabold tracking-[-0.03em] text-slate-900 focus:outline-none">{step === 'programs' ? 'Choose a program' : 'Choose a workout'}</h2>
          </div>
        </div>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 px-5 py-4">
        {step === 'programs' ? <div className="space-y-3">
          {programsQuery.isPending ? <p role="status" className="rounded-[14px] bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading programs…</p> : null}
          {programsQuery.isError ? <div className="rounded-[14px] bg-red-50 p-4"><p role="alert" className="text-sm text-red-700">Unable to load programs. Please try again.</p><button type="button" onClick={() => void programsQuery.refetch()} disabled={programsQuery.isFetching} className="mt-3 min-h-11 rounded-[11px] bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60">{programsQuery.isFetching ? 'Retrying…' : 'Retry'}</button></div> : null}
          {programsQuery.isSuccess && orderedPrograms.map((program) => (
            <PickerRow
              key={program.id}
              buttonRef={(node) => { if (node) programButtonRefs.current.set(program.id, node); else programButtonRefs.current.delete(program.id) }}
              name={program.name}
              minHeight="min-h-[76px]"
              disabled={isCreating}
              onClick={() => chooseProgram(program.id)}
              meta={<><span>{program.dayCount} {program.dayCount === 1 ? 'workout day' : 'workout days'}</span>{program.isActive ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold leading-4 text-slate-500">Active</span> : null}</>}
            />
          ))}
          {programsQuery.isSuccess && orderedPrograms.length === 0 ? <p className="rounded-[14px] bg-slate-50 px-4 py-4 text-sm text-slate-500">No programs with workouts available.</p> : null}
        </div> : null}

        {step === 'workouts' ? <>
          {selectedProgramId ? <div className="mb-3 flex min-w-0 items-start gap-2">
            <p className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-medium leading-5 text-slate-500 [overflow-wrap:anywhere]">{selectedProgram?.name ?? 'Program unavailable'}</p>
            {selectedProgram?.isActive ? <span className="mt-0.5 shrink-0 rounded-full bg-slate-200/70 px-2.5 py-1 text-[10px] font-bold leading-none text-slate-500">Active</span> : null}
          </div> : null}
          <div className="space-y-3">
          {programsQuery.isError ? <div className="rounded-[14px] bg-red-50 p-4"><p role="alert" className="text-sm text-red-700">Unable to verify this program. Please try again.</p><button type="button" onClick={() => void programsQuery.refetch()} disabled={programsQuery.isFetching || isCreating} className="mt-3 min-h-11 rounded-[11px] bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60">{programsQuery.isFetching ? 'Retrying…' : 'Retry'}</button></div> : null}
          {programsQuery.isSuccess && !selectedProgram ? <p className="rounded-[14px] bg-white px-4 py-3 text-sm text-slate-600">This program is no longer available.</p> : null}
          {selectedProgram && selectedProgramQuery.isPending ? <p role="status" className="rounded-[14px] bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading workouts…</p> : null}
          {selectedProgram && selectedProgramQuery.isError ? <div className="rounded-[14px] bg-red-50 p-4"><p role="alert" className="text-sm text-red-700">Unable to load workouts. Please try again.</p><button type="button" onClick={() => void selectedProgramQuery.refetch()} disabled={selectedProgramQuery.isFetching || isCreating} className="mt-3 min-h-11 rounded-[11px] bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60">{selectedProgramQuery.isFetching ? 'Retrying…' : 'Retry'}</button></div> : null}
          {selectedProgram && selectedProgramQuery.isSuccess && (!selectedProgramQuery.data || selectedProgramQuery.data.days.length === 0) ? <p className="rounded-[14px] bg-white px-4 py-3 text-sm text-slate-600">This program has no workouts available.</p> : null}
          {selectedProgramQuery.isSuccess && selectedProgramQuery.data?.days.map((day) => (
            <PickerRow key={day.id} name={day.name} minHeight="min-h-[64px]" onClick={() => onSelectWorkout(day.id)} disabled={isCreating} />
          ))}
          </div>
        </> : null}
      </div>

      {createError ? <div className="mx-4 mb-3 shrink-0 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 sm:mx-5">
        <p role="alert">{createError === 'conflict' ? 'A manual draft already exists. Refresh its status, then resume or discard it before starting another workout.' : 'Unable to open the workout. Check your connection and try again.'}</p>
        {createError === 'conflict' ? <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={onRefreshDraft} disabled={isRefreshingDraft || isCreating} className="min-h-11 rounded-xl bg-white px-3 text-sm font-bold text-slate-800 disabled:opacity-60">{isRefreshingDraft ? 'Refreshing…' : 'Refresh draft status'}</button><button type="button" onClick={close} disabled={isCreating} className="min-h-11 rounded-xl bg-white px-3 text-sm font-bold text-slate-800 disabled:opacity-60">Close to manage draft</button></div> : null}
      </div> : null}
      <footer className="shrink-0 border-t border-slate-100 bg-white p-4 sm:px-5">
        {step === 'workouts' ? <div className="flex gap-3">
          <button type="button" onClick={backToPrograms} disabled={isCreating} className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50">Back</button>
          <button type="button" onClick={close} disabled={isCreating} className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50">{isCreating ? 'Opening workout…' : 'Cancel'}</button>
        </div> : <button type="button" onClick={close} disabled={isCreating} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50">Cancel</button>}
      </footer>
    </Dialog>
  )
}
