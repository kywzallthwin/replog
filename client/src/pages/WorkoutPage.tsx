import type { FormEvent } from 'react'
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
  type WorkoutSet,
} from '../lib/sessions'
import { dashboardQueryKey } from '../lib/dashboard'
import { getBadgeClass } from '../lib/badgeColors'
import { exercisesQueryKey, getExercises } from '../lib/exercises'
import { activeProgramQueryKey, getActiveProgram } from '../lib/programs'
import { ExercisePickerDialog } from '../components/exercises/ExercisePickerDialog'
import { FluidSelect } from '../components/forms/FluidSelect'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'
import { formatWorkoutDuration, useWorkoutTimer } from '../lib/useWorkoutTimer'
import { useRestTimer } from '../lib/useRestTimer'

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
  { value: 'NORMAL', label: 'Normal' },
  { value: 'WARMUP', label: 'Warm-up' },
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

function formatLastTimeDate(date: string) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(date))
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
    <div className="sticky top-3 z-20 mb-5 flex items-center justify-between gap-3 rounded-[16px] bg-slate-900 px-4 py-3 text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)]">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Rest timer</p>
        <p className="mt-1 text-2xl font-black tracking-[-0.04em]">{formatted}</p>
      </div>
      <div className="flex items-center gap-2">
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

function SetRow({
  set,
  setNumber,
  isFinished,
  isDropChild,
  onEdit,
  onDelete,
}: {
  set: WorkoutSet
  setNumber: number
  isFinished: boolean
  isDropChild: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={`flex items-start gap-2 border-b border-slate-100 py-2 text-sm last:border-b-0 ${isDropChild ? 'ml-5 border-l-2 border-l-slate-200 pl-3' : ''}`}>
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
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
            onClick={onDelete}
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
  onCancel,
  onSave,
}: {
  set: WorkoutSet
  isSaving: boolean
  isError: boolean
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const parsedWeightKg = Number(weightKg)
    const parsedReps = Number(reps)

    if (!Number.isFinite(parsedWeightKg) || parsedWeightKg < 0 || parsedWeightKg > 1000) {
      setFormError('Enter a valid weight')
      return
    }

    if (!Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 1000) {
      setFormError('Enter valid reps')
      return
    }

    onSave({ kind, notes: notes.trim() || null, weightKg: parsedWeightKg, reps: parsedReps })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
    >
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Edit Set</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Kind</span>
          <FluidSelect
            value={kind}
            options={[...setKindOptions]}
            onValueChange={(nextKind) => setKind(nextKind as SetKind)}
            ariaLabel="Set kind"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Weight kg</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="1000"
            step="0.5"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Reps</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="1000"
            step="1"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
            required
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
          Set note <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={300}
          rows={2}
          placeholder="e.g. Last 2 reps were partial"
          className="w-full resize-y rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-900 outline-none focus:border-slate-900"
        />
      </label>
      {formError || isError ? (
        <p className="mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {formError || 'Unable to save set. Please try again.'}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
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
  const [exercisePicker, setExercisePicker] = useState<ExercisePickerState | null>(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState | null>(null)
  const [cancelConfirmation, setCancelConfirmation] = useState(false)
  const cancelTriggerRef = useRef<HTMLButtonElement>(null)
  const keepWorkoutButtonRef = useRef<HTMLButtonElement>(null)
  const dropIdRef = useRef(0)
  useBodyScrollLock(Boolean(exercisePicker || deleteConfirmation || cancelConfirmation))
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
  const headerLink = source === 'history' ? '/history' : source === 'progress' ? '/progress' : '/dashboard'
  const headerLinkLabel = source === 'history' ? 'History' : source === 'progress' ? 'Progress' : 'Dashboard'
  const restTimer = useRestTimer(sessionId, Boolean(session && !session.endedAt))
  const addSetMutation = useMutation({
    mutationFn: addSet,
    onSuccess: async (_set, variables) => {
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      setKind('NORMAL')
      setSetFeedbackNote('')
      setWeightKg(variables.weightKg.toString())
      setReps(variables.reps.toString())
      setFormError('')
      restTimer.start()
    },
  })
  const addSetChainMutation = useMutation({
    mutationFn: addSetChain,
    onSuccess: async (_sets, variables) => {
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      setKind('NORMAL')
      setSetFeedbackNote('')
      setWeightKg(variables.sets[0]?.weightKg.toString() ?? '')
      setReps(variables.sets[0]?.reps.toString() ?? '')
      setDropDrafts([])
      setFormError('')
      restTimer.start()
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
  const finishSessionMutation = useMutation({
    mutationFn: finishSession,
    onSuccess: async (updatedSession) => {
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

  useEffect(() => {
    if (cancelConfirmation) {
      keepWorkoutButtonRef.current?.focus()
    }
  }, [cancelConfirmation])

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
    setDropDrafts((current) => [
      ...current,
      { id: dropIdRef.current++, weightKg: '', reps: '' },
    ])
  }

  function updateDropDraft(id: number, field: 'weightKg' | 'reps', value: string) {
    setDropDrafts((current) => current.map((drop) => (drop.id === id ? { ...drop, [field]: value } : drop)))
    setFormError('')
    addSetChainMutation.reset()
  }

  function removeDropDraft(id: number) {
    addSetChainMutation.reset()
    setFormError('')
    setDropDrafts((current) => current.filter((drop) => drop.id !== id))
  }

  function openAddExercisePicker() {
    setExercisePicker({ mode: 'add' })
    setSelectedExerciseId('')
    setActiveExerciseId(null)
    setEditingSet(null)
  }

  function openSwapExercisePicker(exercise: WorkoutExercise) {
    setExercisePicker({ mode: 'swap', sessionExercise: exercise })
    setSelectedExerciseId(exercise.exerciseId)
    setActiveExerciseId(null)
    setEditingSet(null)
  }

  function closeExercisePicker() {
    setExercisePicker(null)
    setSelectedExerciseId('')
  }

  function handleExercisePickerConfirm() {
    if (!sessionId || !exercisePicker || !selectedExerciseId) {
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

    if (!Number.isFinite(parsedWeightKg) || parsedWeightKg < 0 || parsedWeightKg > 1000) {
      setFormError('Enter a valid weight')
      return
    }

    if (!Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 1000) {
      setFormError('Enter valid reps')
      return
    }

    if (dropDrafts.length && kind !== 'NORMAL') {
      setFormError('Drops can only be added to a normal set')
      return
    }

    const parsedDrops = dropDrafts.map((drop) => ({
      weightKg: Number(drop.weightKg),
      reps: Number(drop.reps),
    }))

    if (parsedDrops.some((drop) => !Number.isFinite(drop.weightKg) || drop.weightKg < 0 || drop.weightKg > 1000)) {
      setFormError('Enter a valid weight for every drop')
      return
    }

    if (parsedDrops.some((drop) => !Number.isInteger(drop.reps) || drop.reps < 1 || drop.reps > 1000)) {
      setFormError('Enter valid reps for every drop')
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

    if (!sessionId || !sourceSet || addSetMutation.isPending || addSetChainMutation.isPending) {
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
    setActiveExerciseId(null)
    setEditingSet({ exerciseId: exercise.id, set })
  }

  function handleDeleteSet(exercise: WorkoutExercise, set: WorkoutSet) {
    if (!sessionId) {
      return
    }

    deleteSetMutation.reset()
    removeSessionExerciseMutation.reset()
    setDeleteConfirmation({ type: 'set', exercise, set })
  }

  function handleRemoveExercise(exercise: WorkoutExercise) {
    if (!sessionId) {
      return
    }

    deleteSetMutation.reset()
    removeSessionExerciseMutation.reset()
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
    if (!sessionId || !deleteConfirmation) {
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
    <main className="min-h-dvh bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <Link to={headerLink} className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-900">
              {headerLinkLabel}
            </Link>
            <h1 className="truncate text-[15px] font-bold text-slate-900">
              {session?.dayName ?? 'Workout'}
            </h1>
            {session ? (
              <p className="text-xs text-slate-500">
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
            <p className="text-sm font-semibold text-slate-500">Loading workout...</p>
          </section>
        ) : null}

        {isError ? (
          <section className="p-6">
            <p className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to load this workout session.
            </p>
          </section>
        ) : null}

        {session ? (
          <section className="p-5 sm:p-6">
            <div className="mb-5 rounded-[20px] bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                {session.endedAt ? 'Completed workout' : 'Active workout'}
              </p>
              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] ${getBadgeClass(session.badgeColor)}`}>
                {session.dayName}
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-900">
                {session.dayName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
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

            <div className="space-y-3">
              {session.exercises.map((exercise, index) => {
                const isFinished = Boolean(session.endedAt)
                const activeEdit = editingSet?.exerciseId === exercise.id ? editingSet.set : null
                const latestSet = getLatestSet(exercise)

                return (
                <article
                  key={exercise.id}
                  className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Exercise {index + 1}
                      </p>
                      <h3 className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-900">
                        {exercise.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {exercise.sets.length ? `${exercise.sets.length} sets logged` : 'No sets yet'}
                      </p>
                      {exercise.lastTime ? (
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          Last time: {exercise.lastTime.weightKg} kg x {exercise.lastTime.reps} · {formatLastTimeDate(exercise.lastTime.performedAt)}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs font-semibold text-slate-300">No previous performance</p>
                      )}
                    </div>
                    {isFinished ? null : (
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => openSwapExercisePicker(exercise)}
                          className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Swap
                        </button>
                         <button
                           type="button"
                           onClick={() => openAddSetForm(exercise)}
                          className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                         >
                           Add Set
                         </button>
                        {latestSet ? (
                          <button
                            type="button"
                            onClick={() => handleRepeatSet(exercise)}
                            aria-label="Repeat last set"
                            disabled={addSetMutation.isPending || addSetChainMutation.isPending}
                            className="min-h-11 rounded-[12px] border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                          >
                            Repeat
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleRemoveExercise(exercise)}
                          data-press="icon"
                          data-press-tone="red"
                          title="Remove exercise"
                          aria-label={`Remove ${exercise.name}`}
                          disabled={removeSessionExerciseMutation.isPending}
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
                           isDropChild={Boolean(set.parentSetId)}
                           onEdit={() => openEditSetForm(exercise, set)}
                           onDelete={() => handleDeleteSet(exercise, set)}
                          />
                        )
                      })}
                    </div>
                  ) : null}
                  {!isFinished && activeExerciseId === exercise.id ? (
                    <form
                      onSubmit={(event) => handleAddSet(event, exercise)}
                      className="mt-3 rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                    >
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Add Set</p>
                      <p className="mb-3 text-xs font-medium text-slate-500">
                        Values are prefilled from your latest set. Adjust them only when needed.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
                        <label className="block">
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
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Weight kg</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="1000"
                            step="0.5"
                            value={weightKg}
                            onChange={(event) => setWeightKg(event.target.value)}
                            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                            required
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Reps</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="1000"
                            step="1"
                            value={reps}
                            onChange={(event) => setReps(event.target.value)}
                            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                            required
                          />
                        </label>
                      </div>
                      {kind === 'NORMAL' ? (
                        <div className="mt-4 rounded-[12px] bg-slate-50 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Drop sets</p>
                              <p className="mt-1 text-xs font-medium text-slate-400">Optional. Add each immediate weight and rep change.</p>
                            </div>
                            <button
                              type="button"
                              onClick={addDropDraft}
                              disabled={dropDrafts.length >= 10}
                              className="min-h-11 shrink-0 rounded-[11px] border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                            >
                              + Add drop
                            </button>
                          </div>
                          {dropDrafts.length ? (
                            <div className="mt-3 space-y-2">
                              {dropDrafts.map((drop, index) => (
                                <div key={drop.id} className="rounded-[10px] border border-slate-200 bg-white p-2.5">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Drop {index + 1}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeDropDraft(drop.id)}
                                      className="min-h-9 rounded-full px-2 text-[11px] font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="block">
                                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Weight kg</span>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        max="1000"
                                        step="0.5"
                                        value={drop.weightKg}
                                        onChange={(event) => updateDropDraft(drop.id, 'weightKg', event.target.value)}
                                        className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                                        required
                                      />
                                    </label>
                                    <label className="block">
                                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Reps</span>
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        min="1"
                                        max="1000"
                                        step="1"
                                        value={drop.reps}
                                        onChange={(event) => updateDropDraft(drop.id, 'reps', event.target.value)}
                                        className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                                        required
                                      />
                                    </label>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <label className="mt-4 block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                          Set note <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span>
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
                        <p className="mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                          {formError || 'Unable to add set. Please try again.'}
                        </p>
                      ) : null}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="submit"
                          disabled={addSetMutation.isPending || addSetChainMutation.isPending}
                          className="min-h-11 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                        >
                          {addSetMutation.isPending || addSetChainMutation.isPending ? 'Saving...' : dropDrafts.length ? 'Save Set + Drops' : 'Save Set'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveExerciseId(null)}
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

            {session.endedAt ? (
              <div className="mt-5 rounded-[14px] bg-slate-100 px-4 py-4 text-center">
                <p className="text-sm font-medium text-slate-500">Workout summary complete. These details are read-only.</p>
                <div className="mt-3 flex gap-2">
                  <Link
                    to="/dashboard"
                    className="flex-1 rounded-[12px] bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/history"
                    className="flex-1 rounded-[12px] border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    History
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={openAddExercisePicker}
                  className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  + Add Exercise
                </button>
                <button
                  type="button"
                   onClick={() => finishSessionMutation.mutate(session.id)}
                  disabled={finishSessionMutation.isPending || cancelSessionMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-green-100 px-4 py-3 text-sm font-bold text-green-700 transition hover:bg-green-200 disabled:cursor-not-allowed disabled:bg-green-50 disabled:text-green-400"
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
                  disabled={finishSessionMutation.isPending || cancelSessionMutation.isPending}
                  className="w-full rounded-[14px] border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-300"
                >
                  {cancelSessionMutation.isPending ? 'Cancelling...' : 'Cancel Workout'}
                </button>
                {finishSessionMutation.isError ? (
                  <p className="rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    Unable to finish workout. Please try again.
                  </p>
                ) : null}
                {cancelSessionMutation.isError ? (
                  <p className="rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
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
        />
      ) : null}

      {deleteConfirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeDeleteConfirmation()
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="workout-delete-dialog-title"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-[335px] overflow-y-auto rounded-[22px] bg-white p-[18px] shadow-[0_22px_60px_rgba(15,23,42,0.28)]"
          >
            <div>
              <h2 id="workout-delete-dialog-title" className="text-xl font-extrabold tracking-[-0.03em] text-slate-900">
                {deleteConfirmation.type === 'set'
                  ? `Delete ${deleteConfirmation.set.weightKg} kg x ${deleteConfirmation.set.reps}?`
                  : `Remove ${deleteConfirmation.exercise.name}?`}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {deleteConfirmation.type === 'set'
                  ? `This set will be removed from ${deleteConfirmation.exercise.name}.`
                  : deleteConfirmation.exercise.sets.length
                    ? `This removes the exercise from this workout and deletes ${deleteConfirmation.exercise.sets.length} logged ${
                        deleteConfirmation.exercise.sets.length === 1 ? 'set' : 'sets'
                      }.`
                    : 'This removes the exercise from this workout only.'}
              </p>

              {deleteConfirmationHasError ? (
                <p className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
                className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteConfirmationIsPending}
                className="flex-1 whitespace-nowrap rounded-[14px] border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-300"
              >
                {deleteConfirmationIsPending
                  ? 'Deleting...'
                  : deleteConfirmation.type === 'set'
                    ? 'Delete Set'
                    : 'Remove Exercise'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {cancelConfirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="workout-cancel-dialog-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !cancelSessionMutation.isPending) {
                setCancelConfirmation(false)
                cancelTriggerRef.current?.focus()
              }
            }}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-[335px] overflow-y-auto rounded-[22px] bg-white p-[18px] shadow-[0_22px_60px_rgba(15,23,42,0.28)]"
          >
            <h2 id="workout-cancel-dialog-title" className="text-xl font-extrabold tracking-[-0.03em] text-slate-900">
              Cancel this workout?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will permanently delete the active {session?.dayName ?? 'workout'} session and any sets you have logged. This cannot be undone.
            </p>
            {cancelSessionMutation.isError ? (
              <p className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                Unable to cancel workout. Please try again.
              </p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                ref={keepWorkoutButtonRef}
                onClick={() => {
                  setCancelConfirmation(false)
                  cancelTriggerRef.current?.focus()
                }}
                disabled={cancelSessionMutation.isPending}
                className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
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
                className="flex-1 whitespace-nowrap rounded-[14px] border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-300"
              >
                {cancelSessionMutation.isPending ? 'Cancelling...' : 'Cancel Workout'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
