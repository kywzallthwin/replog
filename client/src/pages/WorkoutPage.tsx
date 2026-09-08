import type { FormEvent, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  addSessionExercise,
  addSet,
  addSetChain,
  cancelSession,
  deleteSet,
  finishSession,
  getSession,
  removeSessionExercise,
  sessionHistoryQueryKey,
  sessionQueryKey,
  swapSessionExercise,
  updateSet,
  type SetKind,
  type WorkoutExercise,
  type WorkoutSession,
  type WorkoutSet,
  type PreviousWorkoutReference,
} from '../lib/sessions'
import { dashboardQueryKey } from '../lib/dashboard'
import { getBadgeClass } from '../lib/badgeColors'
import { exercisesQueryKey, getExercises } from '../lib/exercises'
import { activeProgramQueryKey, getActiveProgram } from '../lib/programs'
import { ExercisePickerDialog } from '../components/exercises/ExercisePickerDialog'
import { FluidSelect } from '../components/forms/FluidSelect'
import { formatWorkoutDuration, useWorkoutTimer } from '../lib/useWorkoutTimer'
import { useRestTimer, type RestTimerSessionStatus } from '../lib/useRestTimer'
import { BrandLogo } from '../components/BrandLogo'
import { Dialog } from '../components/ui/Dialog'
import { PageLoader } from '../components/ui/PageLoader'

type ExercisePickerState =
  | { mode: 'add' }
  | { mode: 'swap'; sessionExercise: WorkoutExercise }

type DeleteConfirmationState =
  | { type: 'set'; exercise: WorkoutExercise; set: WorkoutSet }
  | { type: 'exercise'; exercise: WorkoutExercise }

type DropDraft = {
  id: number
  weightKg: string
  reps: string
}

const setKindOptions = [
  { value: 'WARMUP', label: 'Warm-up' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'DROP', label: 'Drop' },
] as const

const addSetKindOptions = setKindOptions.filter((option) => option.value !== 'DROP')

function formatStartedAt(startedAt: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(startedAt))
}

function formatCompletedDuration(durationSec: number | null) {
  if (durationSec === null) {
    return 'Duration unavailable'
  }

  return `${Math.max(1, Math.round(durationSec / 60))} min`
}

function formatCompactPreviousDate(date: string) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })
    .format(new Date(date))
    .replace(/\s+/g, '')
}

function formatCompactWeight(weightKg: number) {
  return weightKg.toString()
}

function getPreviousSetGroups(previousWorkout: PreviousWorkoutReference) {
  const setsById = new Map(previousWorkout.sets.map((set) => [set.id, set]))
  const dropsByParentId = new Map<string, WorkoutSet[]>()

  for (const set of previousWorkout.sets) {
    if (!set.parentSetId || !setsById.has(set.parentSetId)) {
      continue
    }

    const drops = dropsByParentId.get(set.parentSetId) ?? []
    drops.push(set)
    dropsByParentId.set(set.parentSetId, drops)
  }

  const rootSets = previousWorkout.sets.filter((set) => !set.parentSetId || !setsById.has(set.parentSetId))

  return rootSets.map((rootSet) => ({
    rootSet,
    sets: [rootSet, ...(dropsByParentId.get(rootSet.id) ?? []).sort((left, right) => left.order - right.order)],
  }))
}

function formatCompactPreviousSet(set: WorkoutSet, isRoot: boolean) {
  if (isRoot && set.kind === 'WARMUP') {
    return `wu${formatCompactWeight(set.weightKg)}×${set.reps}`
  }

  if (isRoot && set.kind === 'DROP') {
    return `d${formatCompactWeight(set.weightKg)}×${set.reps}`
  }

  return `${formatCompactWeight(set.weightKg)}×${set.reps}`
}

function PreviousWorkoutLine({ previousWorkout }: { previousWorkout: PreviousWorkoutReference | null }) {
  if (!previousWorkout) {
    return <p className="mb-3 text-[11px] font-semibold text-slate-400">No previous sets</p>
  }

  const groups = getPreviousSetGroups(previousWorkout)

  return (
    <div
      className="mb-3 rounded-[10px] border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-600"
      aria-label={`Previous workout sets from ${formatCompactPreviousDate(previousWorkout.performedAt)}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-black tracking-[0.02em] text-slate-600">{formatCompactPreviousDate(previousWorkout.performedAt)}</span>
        {groups.map((group) => {
          const isBest = group.rootSet.id === previousWorkout.bestNormalSetId
          const title = group.sets
            .map((set, setIndex) => `${setIndex === 0 && set.kind === 'WARMUP' ? 'wu ' : ''}${set.weightKg} kg x ${set.reps}`)
            .join(' -> ')

          return (
            <span key={group.rootSet.id} className="inline-flex flex-wrap items-center gap-x-2 gap-y-1" title={title}>
              <span className="font-black text-slate-400">·</span>
              <span
                className={`inline-flex flex-wrap items-center font-extrabold ${group.rootSet.kind === 'WARMUP' ? 'text-slate-500' : group.rootSet.kind === 'DROP' ? 'text-indigo-600' : isBest ? 'rounded-md bg-green-50 px-1.5 py-0.5 text-green-700' : 'text-slate-700'}`}
              >
                {group.sets.map((set, setIndex) => (
                  <span key={set.id} className="inline-flex items-center">
                    {setIndex > 0 ? <span className="mx-0.5 text-slate-400" aria-hidden="true">→</span> : null}
                    <span>{formatCompactPreviousSet(set, setIndex === 0)}</span>
                  </span>
                ))}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function RestTimer({
  formatted,
  remainingSeconds,
  onAdd,
  onSkip,
}: {
  formatted: string
  remainingSeconds: number
  onAdd: () => void
  onSkip: () => void
}) {
  return (
    <div className="sticky top-3 z-20 mb-5 flex min-w-0 items-center justify-between gap-3 rounded-[16px] bg-slate-900 px-4 py-3 text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)]">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Rest timer</p>
        <p className="mt-1 text-2xl font-black tracking-[-0.04em]">{formatted}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="min-h-11 rounded-[11px] border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-800"
        >
          +15s
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="min-h-11 rounded-[11px] bg-white px-3 py-2 text-xs font-bold text-slate-900 transition hover:bg-slate-100"
        >
          {remainingSeconds === 0 ? 'Dismiss' : 'Skip'}
        </button>
      </div>
    </div>
  )
}

function WorkoutDuration({ startedAt }: { startedAt: string }) {
  const elapsedSeconds = useWorkoutTimer(startedAt)
  const duration = formatWorkoutDuration(elapsedSeconds)

  return (
    <div
      aria-label={`Workout duration ${duration}`}
      className="flex shrink-0 flex-col items-end gap-1.5 py-1 text-right"
    >
      <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.07em] leading-none text-slate-500">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Workout duration
      </span>
      <span className="text-[28px] font-black leading-[0.9] tracking-[-0.05em] text-slate-900">{duration}</span>
    </div>
  )
}

function formatSummaryVolume(volumeKg: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(volumeKg)
}

function getWorkoutSummary(session: WorkoutSession) {
  const sets = session.exercises.flatMap((exercise) => exercise.sets)

  return {
    exerciseCount: session.exercises.length,
    totalSetCount: sets.length,
    normalSetCount: sets.filter((set) => set.kind === 'NORMAL').length,
    totalVolumeKg: sets.reduce((total, set) => total + set.weightKg * set.reps, 0),
  }
}

function CompletedWorkoutSummary({
  session,
  headingRef,
  returnLink,
  returnLabel,
}: {
  session: WorkoutSession
  headingRef: RefObject<HTMLHeadingElement | null>
  returnLink: string
  returnLabel: string
}) {
  const summary = getWorkoutSummary(session)
  const duration = formatWorkoutDuration(Math.max(0, session.durationSec ?? 0))

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workout summary</p>
          <h2 ref={headingRef} tabIndex={-1} className="mt-1 min-w-0 break-words text-[21px] font-extrabold tracking-[-0.04em] text-slate-900 outline-none [overflow-wrap:anywhere]">{session.dayName}</h2>
          <p className="mt-1 min-w-0 break-words text-sm leading-5 text-slate-500 [overflow-wrap:anywhere]">
            {session.programName ? `${session.programName} · ` : ''}Completed workout
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] text-slate-600">
          Read only
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-[13px] bg-slate-50 p-3">
          <strong className="block min-w-0 break-words text-[21px] font-black tracking-[-0.04em] text-slate-900">{duration}</strong>
          <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Duration</span>
        </div>
        <div className="min-w-0 rounded-[13px] bg-slate-50 p-3">
          <strong className="block min-w-0 break-words text-[21px] font-black tracking-[-0.04em] text-slate-900">{summary.exerciseCount}</strong>
          <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Exercises</span>
        </div>
        <div className="min-w-0 rounded-[13px] bg-slate-50 p-3">
          <strong className="block min-w-0 break-words text-[21px] font-black tracking-[-0.04em] text-slate-900">{summary.totalSetCount}</strong>
          <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Total sets</span>
        </div>
        <div className="min-w-0 rounded-[13px] bg-slate-50 p-3">
          <strong className="block min-w-0 break-words text-[21px] font-black tracking-[-0.04em] text-slate-900">{summary.normalSetCount}</strong>
          <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Normal sets</span>
        </div>
        <div className="col-span-2 min-w-0 rounded-[13px] bg-slate-50 p-3">
          <strong className="block min-w-0 break-words text-[21px] font-black tracking-[-0.04em] text-slate-900">{formatSummaryVolume(summary.totalVolumeKg)} kg</strong>
          <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Total volume</span>
        </div>
      </div>

      {summary.exerciseCount === 0 ? (
        <div className="mt-3 rounded-[13px] border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
          <p className="text-sm font-bold text-slate-700">No exercises logged</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">This completed workout is read-only.</p>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Link
          to="/dashboard"
          className="flex-1 rounded-[12px] bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
        >
          Dashboard
        </Link>
        <Link
          to={returnLink}
          className="flex-1 rounded-[12px] border border-slate-300 bg-white px-4 py-3 text-center text-sm font-bold text-slate-600 transition hover:bg-slate-50"
        >
          {returnLabel}
        </Link>
      </div>
    </section>
  )
}

function formatSetKind(kind: SetKind, setNumber: number) {
  if (kind === 'WARMUP') {
    return 'WU'
  }

  if (kind === 'DROP') {
    return 'DROP'
  }

  return setNumber.toString()
}

function getSetBadgeClass(kind: SetKind) {
  if (kind === 'WARMUP') {
    return 'bg-slate-200 text-slate-700 italic'
  }

  if (kind === 'DROP') {
    return 'bg-blue-50 text-blue-700'
  }

  return 'bg-slate-100 text-slate-500'
}

function getLatestSet(exercise: WorkoutExercise) {
  return exercise.sets[exercise.sets.length - 1] ?? null
}

function getRepeatSetGroup(exercise: WorkoutExercise) {
  const latestSet = getLatestSet(exercise)

  if (!latestSet) {
    return []
  }

  const rootSet = latestSet.parentSetId
    ? exercise.sets.find((set) => set.id === latestSet.parentSetId) ?? latestSet
    : latestSet
  const dropSets = exercise.sets
    .filter((set) => set.parentSetId === rootSet.id)
    .sort((left, right) => left.order - right.order)

  return [rootSet, ...dropSets]
}

function getSuggestedSet(exercise: WorkoutExercise) {
  const latestNormalSet = [...exercise.sets].reverse().find((set) => set.kind === 'NORMAL')

  if (latestNormalSet) {
    return latestNormalSet
  }

  return exercise.lastTime ?? getLatestSet(exercise)
}

function getWeightError(value: string) {
  const parsed = Number(value)
  if (!value.trim() || !Number.isFinite(parsed)) return 'Enter a weight.'
  if (parsed < 0) return 'Weight cannot be negative.'
  if (parsed > 1000) return 'Maximum is 1,000 kg.'
  return ''
}

function getRepsError(value: string) {
  const parsed = Number(value)
  if (!value.trim() || !Number.isInteger(parsed) || parsed < 1) return 'Enter whole reps from 1 to 1,000.'
  if (parsed > 1000) return 'Maximum is 1,000 reps.'
  return ''
}

function SetRow({
  set,
  setNumber,
  isFinished,
  isDisabled,
  isDropChild,
  onEdit,
  onDelete,
}: {
  set: WorkoutSet
  setNumber: number
  isFinished: boolean
  isDisabled: boolean
  isDropChild: boolean
  onEdit: () => void
  onDelete: (trigger: HTMLButtonElement) => void
}) {
  return (
    <div className={`flex min-w-0 items-start gap-2 border-b border-slate-100 py-2 text-sm last:border-b-0 ${isDropChild ? 'ml-5 border-l-2 border-l-slate-200 pl-3' : ''}`}>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold tracking-[0.04em] ${getSetBadgeClass(set.kind)}`}>
        {formatSetKind(set.kind, setNumber)}
      </span>
      <div className="min-w-0 grow">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold text-slate-900">{set.weightKg} kg</span>
          <span className="text-xs text-slate-300">x</span>
          <span className="font-medium text-slate-600">{set.reps}</span>
        </div>
        {set.notes ? <p className="mt-1 truncate text-xs font-medium text-slate-500">{set.notes}</p> : null}
      </div>
      {isFinished ? null : (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={isDisabled}
            title="Edit set"
            aria-label="Edit set"
            className="grid h-11 w-11 place-items-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(event) => onDelete(event.currentTarget)}
            disabled={isDisabled}
            title="Delete set"
            aria-label="Delete set"
            className="grid h-11 w-11 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

function EditSetForm({
  set,
  isSaving,
  isError,
  focusRef,
  onCancel,
  onSave,
}: {
  set: WorkoutSet
  isSaving: boolean
  isError: boolean
  focusRef: RefObject<HTMLInputElement | null>
  onCancel: () => void
  onSave: (values: {
    kind: SetKind
    notes: string | null
    weightKg: number
    reps: number
  }) => void
}) {
  const [kind, setKind] = useState<SetKind>(set.kind)
  const [notes, setNotes] = useState(set.notes ?? '')
  const [weightKg, setWeightKg] = useState(set.weightKg.toString())
  const [reps, setReps] = useState(set.reps.toString())
  const [formError, setFormError] = useState('')
  const repsRef = useRef<HTMLInputElement>(null)
  const [fieldError, setFieldError] = useState<'weightKg' | 'reps' | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const parsedWeightKg = Number(weightKg)
    const parsedReps = Number(reps)
    const weightError = getWeightError(weightKg)
    const repsError = getRepsError(reps)

    if (weightError) {
      setFieldError('weightKg')
      requestAnimationFrame(() => focusRef.current?.focus())
      return
    }

    if (repsError) {
      setFieldError('reps')
      requestAnimationFrame(() => repsRef.current?.focus())
      return
    }

    setFieldError(null)
    onSave({ kind, notes: notes.trim() || null, weightKg: parsedWeightKg, reps: parsedReps })
  }

  return (
    <form
      onSubmit={handleSubmit}
                      noValidate
                      className="mt-3 min-w-0 rounded-[14px] border border-slate-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-4"
    >
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Edit Set</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Kind</span>
          <FluidSelect
            value={kind}
            options={[...setKindOptions]}
           onValueChange={(nextKind) => setKind(nextKind as SetKind)}
           ariaLabel="Set kind"
            disabled={isSaving}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Weight kg</span>
          <input
            ref={focusRef}
            disabled={isSaving}
            type="number"
            inputMode="decimal"
            min="0"
            max="1000"
            step="0.5"
            value={weightKg}
            onChange={(event) => { setWeightKg(event.target.value); setFieldError(null) }}
            aria-invalid={fieldError === 'weightKg' || undefined}
            aria-describedby={fieldError === 'weightKg' ? 'edit-weight-error' : undefined}
            className={`h-11 w-full min-w-0 rounded-[10px] border bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900 ${fieldError === 'weightKg' ? 'border-red-400' : 'border-slate-200'}`}
            required
          />
          {fieldError === 'weightKg' ? <p id="edit-weight-error" role="alert" className="mt-1.5 text-xs font-semibold text-red-600">{getWeightError(weightKg)}</p> : null}
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Reps</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="1000"
            step="1"
            value={reps}
            ref={repsRef}
            disabled={isSaving}
            onChange={(event) => { setReps(event.target.value); setFieldError(null) }}
            aria-invalid={fieldError === 'reps' || undefined}
            aria-describedby={fieldError === 'reps' ? 'edit-reps-error' : undefined}
            className={`h-11 w-full min-w-0 rounded-[10px] border bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900 ${fieldError === 'reps' ? 'border-red-400' : 'border-slate-200'}`}
            required
          />
          {fieldError === 'reps' ? <p id="edit-reps-error" role="alert" className="mt-1.5 text-xs font-semibold text-red-600">{getRepsError(reps)}</p> : null}
        </label>
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
          Set note <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span>
        </span>
        <textarea
          value={notes}
          disabled={isSaving}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={300}
          rows={2}
          placeholder="e.g. Last 2 reps were partial"
          className="w-full resize-y rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-900 outline-none focus:border-slate-900"
        />
      </label>
      {formError || isError ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {formError || 'Unable to save set. Please try again.'}
        </p>
      ) : null}
       <div className="sticky bottom-0 z-10 -mx-3 mt-3 flex gap-2 border-t border-slate-100 bg-white px-3 pt-3 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(15,23,42,0.06)] sm:static sm:mx-0 sm:border-0 sm:px-0 sm:pt-0 sm:pb-0 sm:shadow-none">
        <button
          type="submit"
          disabled={isSaving}
          className="min-h-11 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function WorkoutPage() {
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const [editingSet, setEditingSet] = useState<{ exerciseId: string; set: WorkoutSet } | null>(null)
  const [kind, setKind] = useState<SetKind>('NORMAL')
  const [setFeedbackNote, setSetFeedbackNote] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [reps, setReps] = useState('')
  const [dropDrafts, setDropDrafts] = useState<DropDraft[]>([])
  const [formError, setFormError] = useState('')
  const [addFieldError, setAddFieldError] = useState<string | null>(null)
  const [exercisePicker, setExercisePicker] = useState<ExercisePickerState | null>(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState | null>(null)
  const [cancelConfirmation, setCancelConfirmation] = useState(false)
  const cancelTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteConfirmationTriggerRef = useRef<HTMLElement | null>(null)
  const addExerciseButtonRef = useRef<HTMLButtonElement>(null)
  const exercisePickerTriggerRef = useRef<HTMLElement | null>(null)
  const addWeightRef = useRef<HTMLInputElement>(null)
  const addRepsRef = useRef<HTMLInputElement>(null)
  const editWeightRef = useRef<HTMLInputElement>(null)
  const newDropIdRef = useRef<number | null>(null)
  const completedSummaryRef = useRef<HTMLHeadingElement>(null)
  const dropIdRef = useRef(0)
  const { data: session, isError, isPending } = useQuery({
    queryKey: sessionQueryKey(sessionId ?? ''),
    queryFn: () => getSession(sessionId ?? ''),
    enabled: Boolean(sessionId),
    retry: false,
  })
  const {
    data: exerciseOptions = [],
    isError: isExerciseOptionsError,
    isPending: isExerciseOptionsPending,
  } = useQuery({
    queryKey: exercisesQueryKey,
    queryFn: getExercises,
    enabled: Boolean(exercisePicker),
  })
  const {
    data: program,
    isError: isProgramError,
    isPending: isProgramPending,
  } = useQuery({
    queryKey: activeProgramQueryKey,
    queryFn: getActiveProgram,
    enabled: Boolean(exercisePicker),
    retry: false,
  })
  const source = searchParams.get('from')
  const progressExerciseId = source === 'progress' ? searchParams.get('exerciseId') : null
  const progressLink = progressExerciseId
    ? `/progress?exerciseId=${encodeURIComponent(progressExerciseId)}`
    : '/progress'
  const headerLink = source === 'history' ? '/history' : source === 'progress' ? progressLink : '/dashboard'
  const headerLinkLabel = source === 'history' ? 'History' : source === 'progress' ? 'Progress' : 'Dashboard'
  const summaryReturnLink = source === 'progress' ? progressLink : '/history'
  const summaryReturnLabel = source === 'progress' ? 'Progress' : 'History'
  const hasCachedSession = session !== undefined
  const isInitialError = isError && !hasCachedSession
  const isRefreshError = isError && hasCachedSession
  const restTimerSessionStatus: RestTimerSessionStatus = isPending || !session
    ? 'loading'
    : session.endedAt
      ? 'completed'
      : 'active'
  const restTimer = useRestTimer(sessionId, restTimerSessionStatus)
  const addSetMutation = useMutation({
    mutationFn: addSet,
    onSuccess: async (_set, variables) => {
      restTimer.start()

      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      setKind('NORMAL')
      setSetFeedbackNote('')
      setWeightKg(variables.weightKg.toString())
      setReps(variables.reps.toString())
      setFormError('')
      setAddFieldError(null)
    },
  })
  const addSetChainMutation = useMutation({
    mutationFn: addSetChain,
    onSuccess: async (_sets, variables) => {
      restTimer.start()

      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      setKind('NORMAL')
      setSetFeedbackNote('')
      setWeightKg(variables.sets[0]?.weightKg.toString() ?? '')
      setReps(variables.sets[0]?.reps.toString() ?? '')
      setDropDrafts([])
      setFormError('')
    },
  })
  const addSessionExerciseMutation = useMutation({
    mutationFn: addSessionExercise,
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
      setExercisePicker(null)
      setSelectedExerciseId('')
    },
  })
  const swapSessionExerciseMutation = useMutation({
    mutationFn: swapSessionExercise,
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
      setExercisePicker(null)
      setSelectedExerciseId('')
    },
  })
  const removeSessionExerciseMutation = useMutation({
    mutationFn: removeSessionExercise,
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
      setActiveExerciseId(null)
      setEditingSet(null)
      setDeleteConfirmation(null)
    },
  })
  const exercisePickerIsSaving = addSessionExerciseMutation.isPending || swapSessionExerciseMutation.isPending
  const exercisePickerHasError = addSessionExerciseMutation.isError || swapSessionExerciseMutation.isError
  const updateSetMutation = useMutation({
    mutationFn: updateSet,
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      setEditingSet(null)
    },
  })
  const deleteSetMutation = useMutation({
    mutationFn: deleteSet,
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      setEditingSet(null)
      setDeleteConfirmation(null)
    },
  })
  const deleteConfirmationIsPending = deleteSetMutation.isPending || removeSessionExerciseMutation.isPending
  const deleteConfirmationHasError = deleteSetMutation.isError || removeSessionExerciseMutation.isError
  const workoutWriteIsPending =
    addSetMutation.isPending ||
    addSetChainMutation.isPending ||
    addSessionExerciseMutation.isPending ||
    swapSessionExerciseMutation.isPending ||
    removeSessionExerciseMutation.isPending ||
    updateSetMutation.isPending ||
    deleteSetMutation.isPending
  const finishSessionMutation = useMutation({
    mutationFn: finishSession,
    onSuccess: async (updatedSession) => {
      restTimer.clear()

      if (sessionId) {
        queryClient.setQueryData(sessionQueryKey(sessionId), updatedSession)
      }

      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
      await queryClient.invalidateQueries({ queryKey: sessionHistoryQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['progress'] })
    },
  })
  const cancelSessionMutation = useMutation({
    mutationFn: cancelSession,
    onSuccess: async () => {
      restTimer.clear()

      if (sessionId) {
        queryClient.removeQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
      await queryClient.invalidateQueries({ queryKey: sessionHistoryQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['progress'] })
      setCancelConfirmation(false)
      navigate('/dashboard')
    },
  })
  const workoutMutationIsPending = workoutWriteIsPending || finishSessionMutation.isPending || cancelSessionMutation.isPending
  const wasCompletedRef = useRef(Boolean(session?.endedAt))

  useEffect(() => {
    if (activeExerciseId) {
      requestAnimationFrame(() => {
        addWeightRef.current?.focus({ preventScroll: true })
        addWeightRef.current?.scrollIntoView({ block: 'center' })
      })
    }
  }, [activeExerciseId])

  useEffect(() => {
    if (editingSet) {
      requestAnimationFrame(() => {
        editWeightRef.current?.focus({ preventScroll: true })
        editWeightRef.current?.scrollIntoView({ block: 'center' })
      })
    }
  }, [editingSet])

  useEffect(() => {
    if (newDropIdRef.current !== null) {
      const drop = document.querySelector<HTMLInputElement>(`[data-drop-id="${newDropIdRef.current}"]`)
      newDropIdRef.current = null
      requestAnimationFrame(() => {
        drop?.focus({ preventScroll: true })
        drop?.scrollIntoView({ block: 'center' })
      })
    }
  }, [dropDrafts.length])

  useEffect(() => {
    if (!wasCompletedRef.current && session?.endedAt) {
      requestAnimationFrame(() => {
        completedSummaryRef.current?.focus({ preventScroll: true })
        completedSummaryRef.current?.scrollIntoView({ block: 'start' })
      })
    }
    wasCompletedRef.current = Boolean(session?.endedAt)
  }, [session?.endedAt])

  function openAddSetForm(exercise: WorkoutExercise) {
    const suggestedSet = getSuggestedSet(exercise)

    setActiveExerciseId(exercise.id)
    setEditingSet(null)
    addSetMutation.reset()
    addSetChainMutation.reset()
    setKind(exercise.sets.length === 0 ? 'WARMUP' : 'NORMAL')
    setSetFeedbackNote('')
    setWeightKg(suggestedSet?.weightKg.toString() ?? '')
    setReps(suggestedSet?.reps.toString() ?? '')
    setDropDrafts([])
    setFormError('')
  }

  function addDropDraft() {
    addSetChainMutation.reset()
    setFormError('')
    setAddFieldError(null)
    const id = dropIdRef.current++
    newDropIdRef.current = id
    setDropDrafts((current) => [...current, { id, weightKg: '', reps: '' }])
  }

  function updateDropDraft(id: number, field: 'weightKg' | 'reps', value: string) {
    setDropDrafts((current) => current.map((drop) => (drop.id === id ? { ...drop, [field]: value } : drop)))
    setFormError('')
    setAddFieldError(null)
    addSetChainMutation.reset()
  }

  function removeDropDraft(id: number) {
    addSetChainMutation.reset()
    setFormError('')
    setAddFieldError(null)
    setDropDrafts((current) => current.filter((drop) => drop.id !== id))
  }

  function openAddExercisePicker(trigger?: HTMLElement) {
    if (workoutMutationIsPending) return
    if (trigger) {
      exercisePickerTriggerRef.current = trigger
    }

    setExercisePicker({ mode: 'add' })
    addSessionExerciseMutation.reset()
    swapSessionExerciseMutation.reset()
    setSelectedExerciseId('')
    setActiveExerciseId(null)
    setEditingSet(null)
  }

  function openSwapExercisePicker(exercise: WorkoutExercise, trigger?: HTMLElement) {
    if (workoutMutationIsPending || exercise.sets.length > 0) return
    if (trigger) {
      exercisePickerTriggerRef.current = trigger
    }

    setExercisePicker({ mode: 'swap', sessionExercise: exercise })
    addSessionExerciseMutation.reset()
    swapSessionExerciseMutation.reset()
    setSelectedExerciseId(exercise.exerciseId)
    setActiveExerciseId(null)
    setEditingSet(null)
  }

  function closeExercisePicker() {
    setExercisePicker(null)
    setSelectedExerciseId('')
  }

  function handleExercisePickerConfirm() {
    if (!sessionId || !exercisePicker || !selectedExerciseId || workoutMutationIsPending) {
      return
    }

    if (exercisePicker.mode === 'add') {
      addSessionExerciseMutation.mutate({ sessionId, exerciseId: selectedExerciseId })
      return
    }

    swapSessionExerciseMutation.mutate({
      sessionId,
      sessionExerciseId: exercisePicker.sessionExercise.id,
      exerciseId: selectedExerciseId,
    })
  }

  function handleAddSet(event: FormEvent<HTMLFormElement>, exercise: WorkoutExercise) {
    event.preventDefault()
    setFormError('')

    if (!sessionId) {
      setFormError('Missing workout session')
      return
    }

    const parsedWeightKg = Number(weightKg)
    const parsedReps = Number(reps)

    if (!weightKg.trim() || !Number.isFinite(parsedWeightKg) || parsedWeightKg < 0 || parsedWeightKg > 1000) {
      setFormError(getWeightError(weightKg))
      setAddFieldError('weight')
      requestAnimationFrame(() => addWeightRef.current?.focus())
      return
    }

    if (!reps.trim() || !Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 1000) {
      setFormError(getRepsError(reps))
      setAddFieldError('reps')
      requestAnimationFrame(() => addRepsRef.current?.focus())
      return
    }

    if (dropDrafts.length && kind !== 'NORMAL') {
      setFormError('Drops can only be added to a normal set')
      setAddFieldError(null)
      return
    }

    const parsedDrops = dropDrafts.map((drop) => ({
      weightKg: Number(drop.weightKg),
      reps: Number(drop.reps),
    }))

    const invalidDropIndex = dropDrafts.findIndex((drop, index) => {
      const parsed = parsedDrops[index]
      return !drop.weightKg.trim() || !Number.isFinite(parsed.weightKg) || parsed.weightKg < 0 || parsed.weightKg > 1000
    })
    if (invalidDropIndex >= 0) {
      setFormError('Enter a valid weight for every drop')
      setAddFieldError(`drop-weight-${dropDrafts[invalidDropIndex].id}`)
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-drop-id="${dropDrafts[invalidDropIndex].id}"]`)?.focus())
      return
    }

    const invalidDropRepsIndex = dropDrafts.findIndex((drop, index) => {
      const parsed = parsedDrops[index]
      return !drop.reps.trim() || !Number.isInteger(parsed.reps) || parsed.reps < 1 || parsed.reps > 1000
    })
    if (invalidDropRepsIndex >= 0) {
      setFormError('Enter valid reps for every drop')
      setAddFieldError(`drop-reps-${dropDrafts[invalidDropRepsIndex].id}`)
      requestAnimationFrame(() => document.querySelectorAll<HTMLInputElement>(`[data-drop-id="${dropDrafts[invalidDropRepsIndex].id}"]`)[1]?.focus())
      return
    }

    if (dropDrafts.length) {
      addSetChainMutation.mutate({
        sessionId,
        sessionExerciseId: exercise.id,
        sets: [
          { kind: 'NORMAL', notes: setFeedbackNote.trim() || null, weightKg: parsedWeightKg, reps: parsedReps },
          ...parsedDrops.map((drop) => ({ kind: 'DROP' as const, ...drop })),
        ],
      })
      return
    }

    addSetMutation.mutate({
      sessionId,
      sessionExerciseId: exercise.id,
      kind,
      notes: setFeedbackNote.trim() || null,
      weightKg: parsedWeightKg,
      reps: parsedReps,
    })
  }

  function handleRepeatSet(exercise: WorkoutExercise) {
    const repeatGroup = getRepeatSetGroup(exercise)
    const sourceSet = repeatGroup[0]

    if (!sessionId || !sourceSet || workoutMutationIsPending) {
      return
    }

    setActiveExerciseId(null)
    setEditingSet(null)
    setFormError('')
    if (repeatGroup.length > 1) {
      addSetChainMutation.mutate({
        sessionId,
        sessionExerciseId: exercise.id,
        sets: repeatGroup.map((set, index) => ({
          kind: index === 0 ? 'NORMAL' : 'DROP',
          weightKg: set.weightKg,
          reps: set.reps,
        })),
      })
      return
    }

    addSetMutation.mutate({
      sessionId,
      sessionExerciseId: exercise.id,
      kind: sourceSet.kind === 'WARMUP' ? 'NORMAL' : sourceSet.kind,
      weightKg: sourceSet.weightKg,
      reps: sourceSet.reps,
    })
  }

  function openEditSetForm(exercise: WorkoutExercise, set: WorkoutSet) {
    if (workoutMutationIsPending) return
    updateSetMutation.reset()
    setActiveExerciseId(null)
    setEditingSet({ exerciseId: exercise.id, set })
  }

  function handleDeleteSet(exercise: WorkoutExercise, set: WorkoutSet, trigger?: HTMLElement) {
    if (!sessionId || workoutMutationIsPending) {
      return
    }

    deleteSetMutation.reset()
    removeSessionExerciseMutation.reset()
    deleteConfirmationTriggerRef.current = trigger ?? null
    setDeleteConfirmation({ type: 'set', exercise, set })
  }

  function handleRemoveExercise(exercise: WorkoutExercise, trigger?: HTMLElement) {
    if (!sessionId || workoutMutationIsPending) {
      return
    }

    deleteSetMutation.reset()
    removeSessionExerciseMutation.reset()
    deleteConfirmationTriggerRef.current = trigger ?? null
    setDeleteConfirmation({ type: 'exercise', exercise })
  }

  function closeDeleteConfirmation() {
    if (deleteConfirmationIsPending) {
      return
    }

    deleteSetMutation.reset()
    removeSessionExerciseMutation.reset()
    setDeleteConfirmation(null)
  }

  function confirmDelete() {
    if (!sessionId || !deleteConfirmation || workoutMutationIsPending) {
      return
    }

    if (deleteConfirmation.type === 'set') {
      deleteSetMutation.mutate({
        sessionId,
        sessionExerciseId: deleteConfirmation.exercise.id,
        setId: deleteConfirmation.set.id,
      })
      return
    }

    removeSessionExerciseMutation.mutate({
      sessionId,
      sessionExerciseId: deleteConfirmation.exercise.id,
    })
  }

  return (
    <main className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-slate-100 px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
      <div className="mx-auto w-full min-w-0 max-w-4xl rounded-[28px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <Link
              to={headerLink}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-900"
            >
              <BrandLogo compact alt="" className="h-5 w-5" />
              {headerLinkLabel}
            </Link>
            <h1 className="min-w-0 break-words text-[15px] font-bold text-slate-900 [overflow-wrap:anywhere]">
              {session?.dayName ?? 'Workout'}
            </h1>
            {session ? (
              <p className="min-w-0 break-words text-xs text-slate-500 [overflow-wrap:anywhere]">
                {session.programName ? `${session.programName} · ` : ''}Started {formatStartedAt(session.startedAt)}
              </p>
            ) : null}
          </div>
          {session && !session.endedAt ? (
            <WorkoutDuration startedAt={session.startedAt} />
          ) : session ? (
            <div className="flex shrink-0 flex-col items-end gap-1 py-1 text-right">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-slate-500">Workout duration</span>
              <span className="text-sm font-black text-slate-900">{formatCompletedDuration(session.durationSec)}</span>
            </div>
          ) : null}
        </header>

        {isPending ? (
          <section className="p-6">
            <PageLoader statusMessage="Loading workout..." />
          </section>
        ) : null}

        {isInitialError ? (
          <section className="p-6">
            <p role="alert" className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to load this workout session.
            </p>
          </section>
        ) : null}

        {isRefreshError ? (
          <p role="alert" className="mx-4 mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:mx-6">
            Unable to refresh this workout. Showing previously loaded values.
          </p>
        ) : null}

        {session ? (
          <section className="min-w-0 p-4 sm:p-6">
            <div className="mb-5 rounded-[20px] bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                {session.endedAt ? 'Completed workout' : 'Active workout'}
              </p>
              <span className={`mt-2 inline-flex max-w-full whitespace-normal break-words rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] [overflow-wrap:anywhere] ${getBadgeClass(session.badgeColor)}`}>
                {session.dayName}
              </span>
              <h2 className="mt-2 min-w-0 break-words text-3xl font-extrabold tracking-[-0.04em] text-slate-900 [overflow-wrap:anywhere]">
                {session.dayName}
              </h2>
              <p className="mt-1 min-w-0 break-words text-sm text-slate-500 [overflow-wrap:anywhere]">
                {session.programName ? `${session.programName} · ` : ''}
                {session.endedAt ? `Finished in ${formatCompletedDuration(session.durationSec)}` : `Started ${formatStartedAt(session.startedAt)}`} · {session.exercises.length} exercises
              </p>
            </div>

            {!session.endedAt && restTimer.remainingSeconds !== null ? (
              <RestTimer
                formatted={restTimer.formatted ?? '0:00'}
                remainingSeconds={restTimer.remainingSeconds}
                onAdd={() => restTimer.addSeconds(15)}
                onSkip={restTimer.skip}
              />
            ) : null}

            {session.endedAt ? (
              <CompletedWorkoutSummary
                session={session}
                headingRef={completedSummaryRef}
                returnLink={summaryReturnLink}
                returnLabel={summaryReturnLabel}
              />
            ) : null}

            <div className="mt-5 space-y-3">
              {session.exercises.map((exercise, index) => {
                const isFinished = Boolean(session.endedAt)
                const activeEdit = editingSet?.exerciseId === exercise.id ? editingSet.set : null
                const latestSet = getLatestSet(exercise)

                return (
                <article
                  key={exercise.id}
                  className="min-w-0 rounded-[18px] border border-slate-100 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-4"
                >
                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Exercise {index + 1}
                      </p>
                      <h3 className="mt-1 min-w-0 break-words text-lg font-bold tracking-[-0.02em] text-slate-900 [overflow-wrap:anywhere]">
                        {exercise.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {exercise.sets.length ? `${exercise.sets.length} sets logged` : 'No sets yet'}
                      </p>
                    </div>
                    {isFinished ? null : (
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                        <button
                          type="button"
                          onClick={(event) => openSwapExercisePicker(exercise, event.currentTarget)}
                          disabled={workoutMutationIsPending || exercise.sets.length > 0}
                          aria-describedby={exercise.sets.length > 0 ? `swap-explanation-${exercise.id}` : undefined}
                          className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          Swap
                        </button>
                         {exercise.sets.length > 0 ? <span id={`swap-explanation-${exercise.id}`} className="w-full text-[11px] font-semibold leading-4 text-slate-400">Remove logged sets before swapping this exercise.</span> : null}
                         <button
                           type="button"
                           onClick={() => openAddSetForm(exercise)}
                           disabled={workoutMutationIsPending}
                           className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                         >
                           Add Set
                         </button>
                        {latestSet ? (
                          <button
                            type="button"
                            onClick={() => handleRepeatSet(exercise)}
                            aria-label="Repeat last set"
                            disabled={workoutMutationIsPending}
                            className="min-h-11 rounded-[12px] border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                          >
                            Repeat
                          </button>
                        ) : null}
                        <button
                          type="button"
                           onClick={(event) => handleRemoveExercise(exercise, event.currentTarget)}
                          data-press="icon"
                          data-press-tone="red"
                          title="Remove exercise"
                          aria-label={`Remove ${exercise.name}`}
                            disabled={workoutMutationIsPending}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {exercise.sets.length ? (
                    <div className="mt-3 rounded-[12px] bg-slate-50 px-3 py-1">
                      {exercise.sets.map((set, setIndex) => {
                        const setNumber = exercise.sets
                          .slice(0, setIndex + 1)
                          .filter((candidate) => candidate.kind === 'NORMAL').length

                        return (
                          <SetRow
                            key={set.id}
                           set={set}
                           setNumber={setNumber}
                            isFinished={isFinished}
                            isDisabled={workoutMutationIsPending}
                           isDropChild={Boolean(set.parentSetId)}
                           onEdit={() => openEditSetForm(exercise, set)}
                            onDelete={(trigger) => handleDeleteSet(exercise, set, trigger)}
                          />
                        )
                      })}
                    </div>
                  ) : null}
                  {!isFinished && activeExerciseId === exercise.id ? (
                    <form
                      onSubmit={(event) => handleAddSet(event, exercise)}
      noValidate
      className="mt-3 min-w-0 rounded-[14px] border border-slate-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-4"
                    >
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">New Set</p>
                      {exercise.previousWorkout ? (
                        <p className="mb-3 text-xs font-semibold text-slate-500">Last Set . KgxRepxDrop</p>
                      ) : null}
                      <PreviousWorkoutLine previousWorkout={exercise.previousWorkout} />
                      <div className="grid min-w-0 gap-3">
                        <label className="block min-w-0">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Kind</span>
                          <FluidSelect
                            value={kind}
                            options={[...addSetKindOptions]}
                            onValueChange={(nextKind) => {
                              const nextSetKind = nextKind as SetKind
                              setKind(nextSetKind)
                              if (nextSetKind !== 'NORMAL') {
                                setDropDrafts([])
                              }
                            }}
                            ariaLabel="Set kind"
                          />
                        </label>
                        <div className={`grid min-w-0 gap-2 ${kind === 'NORMAL' ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem]' : 'grid-cols-2'}`}>
                          <label className="block min-w-0">
                          <span className="mb-1 flex h-6 items-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Weight kg</span>
                           <input
                             ref={addWeightRef}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="1000"
                            step="0.5"
                             value={weightKg}
                             onChange={(event) => { setWeightKg(event.target.value); setAddFieldError(null); setFormError('') }}
                             aria-invalid={addFieldError === 'weight' || undefined}
                             aria-describedby={addFieldError === 'weight' ? 'add-set-error' : undefined}
                            className="h-11 w-full min-w-0 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                            required
                          />
                          </label>
                          <label className="block min-w-0">
                          <span className="mb-1 flex h-6 items-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Reps</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="1000"
                            step="1"
                             ref={addRepsRef}
                             value={reps}
                             onChange={(event) => { setReps(event.target.value); setAddFieldError(null); setFormError('') }}
                             aria-invalid={addFieldError === 'reps' || undefined}
                             aria-describedby={addFieldError === 'reps' ? 'add-set-error' : undefined}
                            className="h-11 w-full min-w-0 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                            required
                          />
                          </label>
                          {kind === 'NORMAL' ? (
                            <div data-testid="add-drop-action" className="block min-w-0">
                              <span className="mb-1 flex h-6 items-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Drop</span>
                              <button
                                type="button"
                                onClick={addDropDraft}
                                disabled={dropDrafts.length >= 9 || workoutMutationIsPending}
                                aria-label={`Add drop set. ${dropDrafts.length} of 9 added`}
                                className="flex h-11 w-full items-center justify-center rounded-[10px] border border-blue-200 bg-blue-50 text-xl font-bold leading-none text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                {dropDrafts.length >= 9 ? '9/9' : '+'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {kind === 'NORMAL' && dropDrafts.length ? (
                        <div className="mt-2 space-y-2">
                          {dropDrafts.map((drop, dropIndex) => (
                            <div key={drop.id} data-testid="drop-fields" className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 p-2">
                              <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold tracking-[0.04em] text-blue-700">
                                DROP {dropIndex + 1}
                              </span>
                              <label className="block min-w-0">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    max="1000"
                                    step="0.5"
                                    data-drop-id={drop.id}
                                    data-drop-field="weightKg"
                                     value={drop.weightKg}
                                     onChange={(event) => updateDropDraft(drop.id, 'weightKg', event.target.value)}
                                     aria-invalid={addFieldError === `drop-weight-${drop.id}` || undefined}
                                     aria-describedby={addFieldError === `drop-weight-${drop.id}` ? 'add-set-error' : undefined}
                                    aria-label={`Drop ${dropIndex + 1} weight kg`}
                                    placeholder="kg"
                                    className="h-11 w-full min-w-0 rounded-[8px] border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                                    required
                                  />
                              </label>
                              <label className="block min-w-0">
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    max="1000"
                                    step="1"
                                    data-drop-id={drop.id}
                                    data-drop-field="reps"
                                    value={drop.reps}
                                     onChange={(event) => updateDropDraft(drop.id, 'reps', event.target.value)}
                                     aria-invalid={addFieldError === `drop-reps-${drop.id}` || undefined}
                                     aria-describedby={addFieldError === `drop-reps-${drop.id}` ? 'add-set-error' : undefined}
                                    aria-label={`Drop ${dropIndex + 1} reps`}
                                    placeholder="reps"
                                    className="h-11 w-full min-w-0 rounded-[8px] border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                                    required
                                  />
                              </label>
                              <button
                                type="button"
                                onClick={() => removeDropDraft(drop.id)}
                                disabled={workoutMutationIsPending}
                                aria-label={`Remove drop ${dropIndex + 1}`}
                                className="grid h-11 w-11 place-items-center rounded-full text-base font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <label className="mt-4 block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                            Note <span className="font-medium normal-case tracking-normal text-slate-300">· optional</span>
                        </span>
                        <textarea
                          value={setFeedbackNote}
                          onChange={(event) => setSetFeedbackNote(event.target.value)}
                          maxLength={300}
                          rows={2}
                          placeholder="e.g. Last 2 reps were partial"
                          className="w-full resize-y rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-900 outline-none focus:border-slate-900"
                        />
                      </label>
                      {formError || addSetMutation.isError || addSetChainMutation.isError ? (
                         <p id="add-set-error" role="alert" className="mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                          {formError || 'Unable to add set. Please try again.'}
                        </p>
                      ) : null}
                       <div className="sticky bottom-0 z-10 -mx-3 mt-3 flex gap-2 border-t border-slate-100 bg-white px-3 pt-3 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(15,23,42,0.06)] sm:static sm:mx-0 sm:border-0 sm:px-0 sm:pt-0 sm:pb-0 sm:shadow-none">
                   <button
                          type="submit"
                           disabled={workoutMutationIsPending}
                          className="min-h-11 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                        >
                          {addSetMutation.isPending || addSetChainMutation.isPending ? 'Saving...' : 'Save Set'}
                        </button>
                        <button
                          type="button"
                           onClick={() => setActiveExerciseId(null)}
                           disabled={workoutMutationIsPending}
                          className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {!isFinished && activeEdit ? (
                    <EditSetForm
                      key={activeEdit.id}
                      set={activeEdit}
                       isSaving={updateSetMutation.isPending}
                       isError={updateSetMutation.isError}
                       focusRef={editWeightRef}
                       onCancel={() => setEditingSet(null)}
                      onSave={(values) => {
                        if (!sessionId) {
                          return
                        }

                        updateSetMutation.mutate({
                          sessionId,
                          sessionExerciseId: exercise.id,
                          setId: activeEdit.id,
                          ...values,
                        })
                      }}
                    />
                  ) : null}
                </article>
                )
              })}
            </div>

            {session.endedAt ? null : (
              <div className="mt-5 space-y-3">
                 <button
                   ref={addExerciseButtonRef}
                   type="button"
                   onClick={(event) => openAddExercisePicker(event.currentTarget)}
                   disabled={workoutMutationIsPending}
                   className="min-h-11 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                  + Add Exercise
                </button>
                <button
                  type="button"
                  onClick={() => finishSessionMutation.mutate(session.id)}
                  disabled={finishSessionMutation.isPending || cancelSessionMutation.isPending || workoutWriteIsPending}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-green-100 px-4 py-3 text-sm font-bold text-green-700 transition hover:bg-green-200 disabled:cursor-not-allowed disabled:bg-green-50 disabled:text-green-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{finishSessionMutation.isPending ? 'Finishing...' : 'Finish Workout'}</span>
                </button>
                <button
                  type="button"
                    ref={cancelTriggerRef}
                  onClick={() => {
                    cancelSessionMutation.reset()
                    setCancelConfirmation(true)
                  }}
                   disabled={workoutMutationIsPending}
                  className="min-h-11 w-full rounded-[14px] border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-300"
                >
                  {cancelSessionMutation.isPending ? 'Cancelling...' : 'Cancel Workout'}
                </button>
                {finishSessionMutation.isError ? (
                   <p role="alert" className="rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    Unable to finish workout. Please try again.
                  </p>
                ) : null}
                 {cancelSessionMutation.isError && !cancelConfirmation ? (
                   <p role="alert" className="rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    Unable to cancel workout. Please try again.
                  </p>
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </div>

      {exercisePicker ? (
        <ExercisePickerDialog
          mode={exercisePicker.mode}
          currentExerciseName={exercisePicker.mode === 'swap' ? exercisePicker.sessionExercise.name : undefined}
          exerciseOptions={exerciseOptions}
          program={program}
          programIsPending={isProgramPending}
          programIsError={isProgramError}
          targetDayId={session?.dayId ?? undefined}
          existingExerciseIds={session?.exercises.map((exercise) => exercise.exerciseId) ?? []}
           currentExerciseId={exercisePicker.mode === 'swap' ? exercisePicker.sessionExercise.exerciseId : undefined}
           selectedExerciseId={selectedExerciseId}
           isOptionsPending={isExerciseOptionsPending}
           isOptionsError={isExerciseOptionsError}
           isSaving={exercisePickerIsSaving}
           saveError={exercisePickerHasError ? 'Unable to save exercise change. Please try again.' : undefined}
           onSelectedExercise={setSelectedExerciseId}
           onConfirm={handleExercisePickerConfirm}
           onClose={closeExercisePicker}
           onCreated={(exercise) => setSelectedExerciseId(exercise.id)}
           restoreFocusRef={exercisePickerTriggerRef}
         />
       ) : null}

      {deleteConfirmation ? (
        <Dialog
          role="alertdialog"
          labelledBy="workout-delete-dialog-title"
          describedBy="workout-delete-dialog-description"
           onClose={closeDeleteConfirmation}
           closeOnEscape={!deleteConfirmationIsPending}
           restoreFocusRef={deleteConfirmationTriggerRef}
           fallbackFocusRef={addExerciseButtonRef}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
          className="max-h-[calc(100dvh-2rem)] w-full max-w-[335px] overflow-y-auto rounded-[22px] bg-white p-[18px] shadow-[0_22px_60px_rgba(15,23,42,0.28)]"
        >
          <div>
            <h2 id="workout-delete-dialog-title" className="min-w-0 break-words text-xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">
              {deleteConfirmation.type === 'set'
                ? `Delete ${deleteConfirmation.set.weightKg} kg x ${deleteConfirmation.set.reps}?`
                : `Remove ${deleteConfirmation.exercise.name}?`}
            </h2>
            <p id="workout-delete-dialog-description" className="mt-2 min-w-0 break-words text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
              {deleteConfirmation.type === 'set'
                ? `This set will be removed from ${deleteConfirmation.exercise.name}.`
                : deleteConfirmation.exercise.sets.length
                  ? `This removes the exercise from this workout and deletes ${deleteConfirmation.exercise.sets.length} logged ${
                      deleteConfirmation.exercise.sets.length === 1 ? 'set' : 'sets'
                    }.`
                  : 'This removes the exercise from this workout only.'}
            </p>

            {deleteConfirmationHasError ? (
              <p role="alert" className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {deleteConfirmation.type === 'set'
                  ? 'Unable to delete set. Please try again.'
                  : 'Unable to remove exercise. Please try again.'}
              </p>
            ) : null}
          </div>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={closeDeleteConfirmation}
              disabled={deleteConfirmationIsPending}
              className="min-h-11 flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteConfirmationIsPending}
              className="min-h-11 flex-1 whitespace-nowrap rounded-[14px] border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-300"
            >
              {deleteConfirmationIsPending
                ? 'Deleting...'
                : deleteConfirmation.type === 'set'
                  ? 'Delete Set'
                  : 'Remove Exercise'}
            </button>
          </div>
        </Dialog>
      ) : null}
      {cancelConfirmation ? (
        <Dialog
          role="alertdialog"
          labelledBy="workout-cancel-dialog-title"
          describedBy="workout-cancel-dialog-description"
          onClose={() => {
            if (!cancelSessionMutation.isPending) setCancelConfirmation(false)
          }}
          closeOnEscape={!cancelSessionMutation.isPending}
          restoreFocusRef={cancelTriggerRef}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
          className="max-h-[calc(100dvh-2rem)] w-full max-w-[335px] overflow-y-auto rounded-[22px] bg-white p-[18px] shadow-[0_22px_60px_rgba(15,23,42,0.28)]"
        >
            <h2 id="workout-cancel-dialog-title" className="min-w-0 break-words text-xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">
              Cancel this workout?
            </h2>
            <p id="workout-cancel-dialog-description" className="mt-2 min-w-0 break-words text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
              This will permanently delete the active {session?.dayName ?? 'workout'} session and any sets you have logged. This cannot be undone.
            </p>
            {cancelSessionMutation.isError ? (
              <p role="alert" className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                Unable to cancel workout. Please try again.
              </p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setCancelConfirmation(false)}
                disabled={cancelSessionMutation.isPending}
                className="min-h-11 flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Keep Workout
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sessionId) {
                    cancelSessionMutation.mutate(sessionId)
                  }
                }}
                disabled={cancelSessionMutation.isPending}
                className="min-h-11 flex-1 whitespace-nowrap rounded-[14px] border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-300"
              >
                {cancelSessionMutation.isPending ? 'Cancelling...' : 'Cancel Workout'}
              </button>
            </div>
        </Dialog>
      ) : null}
    </main>
  )
}
