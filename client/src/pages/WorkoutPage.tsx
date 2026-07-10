import type { FormEvent } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  addSessionExercise,
  addSet,
  deleteSet,
  finishSession,
  getSession,
  removeSessionExercise,
  sessionQueryKey,
  swapSessionExercise,
  updateSet,
  type SetKind,
  type WorkoutExercise,
  type WorkoutSet,
} from '../lib/sessions'
import { dashboardQueryKey } from '../lib/dashboard'
import { exercisesQueryKey, getExercises, type ExerciseCategory } from '../lib/exercises'

type ExercisePickerState =
  | { mode: 'add' }
  | { mode: 'swap'; sessionExercise: WorkoutExercise }

type DeleteConfirmationState =
  | { type: 'set'; exercise: WorkoutExercise; set: WorkoutSet }
  | { type: 'exercise'; exercise: WorkoutExercise }

const exerciseCategoryLabels: Record<ExerciseCategory, string> = {
  CHEST: 'Chest',
  BACK: 'Back',
  SHOULDERS: 'Shoulders',
  LEGS: 'Legs',
  ARMS: 'Arms',
  CORE: 'Core',
}

const exerciseCategoryOrder: ExerciseCategory[] = ['CHEST', 'BACK', 'SHOULDERS', 'LEGS', 'ARMS', 'CORE']

function formatStartedAt(startedAt: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(startedAt))
}

function formatSetKind(kind: SetKind, order: number) {
  if (kind === 'WARMUP') {
    return 'WU'
  }

  if (kind === 'DROP') {
    return 'DROP'
  }

  return order.toString()
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

function SetRow({
  set,
  isFinished,
  onEdit,
  onDelete,
}: {
  set: WorkoutSet
  isFinished: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold tracking-[0.04em] ${getSetBadgeClass(set.kind)}`}>
        {formatSetKind(set.kind, set.order)}
      </span>
      <span className="font-bold text-slate-900">{set.weightKg} kg</span>
      <span className="text-xs text-slate-300">x</span>
      <span className="font-medium text-slate-600">{set.reps}</span>
      <span className="grow" />
      {isFinished ? null : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            title="Edit set"
            aria-label="Edit set"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
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
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500"
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
  onSave: (values: { kind: SetKind; weightKg: number; reps: number }) => void
}) {
  const [kind, setKind] = useState<SetKind>(set.kind)
  const [weightKg, setWeightKg] = useState(set.weightKg.toString())
  const [reps, setReps] = useState(set.reps.toString())
  const [formError, setFormError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const parsedWeightKg = Number(weightKg)
    const parsedReps = Number(reps)

    if (!Number.isFinite(parsedWeightKg) || parsedWeightKg < 0) {
      setFormError('Enter a valid weight')
      return
    }

    if (!Number.isInteger(parsedReps) || parsedReps < 1) {
      setFormError('Enter valid reps')
      return
    }

    onSave({ kind, weightKg: parsedWeightKg, reps: parsedReps })
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
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as SetKind)}
            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900"
          >
            <option value="NORMAL">Normal</option>
            <option value="WARMUP">Warm-up</option>
            <option value="DROP">Drop</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Weight kg</span>
          <input
            type="number"
            min="0"
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
            min="1"
            step="1"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
            required
          />
        </label>
      </div>
      {formError || isError ? (
        <p className="mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {formError || 'Unable to save set. Please try again.'}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
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
  const [weightKg, setWeightKg] = useState('')
  const [reps, setReps] = useState('')
  const [formError, setFormError] = useState('')
  const [exercisePicker, setExercisePicker] = useState<ExercisePickerState | null>(null)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState | null>(null)
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
  const source = searchParams.get('from')
  const headerLink = source === 'history' ? '/history' : '/dashboard'
  const headerLinkLabel = source === 'history' ? 'History' : 'Dashboard'
  const visibleExerciseOptions = exerciseOptions.filter((exercise) =>
    exercise.name.toLowerCase().includes(exerciseSearch.trim().toLowerCase()),
  )
  const groupedExerciseOptions = exerciseCategoryOrder
    .map((category) => ({
      category,
      exercises: visibleExerciseOptions.filter((exercise) => exercise.category === category),
    }))
    .filter((group) => group.exercises.length > 0)
  const addSetMutation = useMutation({
    mutationFn: addSet,
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      setActiveExerciseId(null)
      setKind('NORMAL')
      setWeightKg('')
      setReps('')
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
      setExerciseSearch('')
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
      setExerciseSearch('')
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
  const isCurrentSwapSelection =
    exercisePicker?.mode === 'swap' && selectedExerciseId === exercisePicker.sessionExercise.exerciseId
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
      navigate('/dashboard')
    },
  })

  function openAddSetForm(exercise: WorkoutExercise) {
    setActiveExerciseId(exercise.id)
    setEditingSet(null)
    setKind('NORMAL')
    setWeightKg('')
    setReps('')
    setFormError('')
  }

  function openAddExercisePicker() {
    setExercisePicker({ mode: 'add' })
    setSelectedExerciseId('')
    setExerciseSearch('')
    setActiveExerciseId(null)
    setEditingSet(null)
  }

  function openSwapExercisePicker(exercise: WorkoutExercise) {
    setExercisePicker({ mode: 'swap', sessionExercise: exercise })
    setSelectedExerciseId(exercise.exerciseId)
    setExerciseSearch('')
    setActiveExerciseId(null)
    setEditingSet(null)
  }

  function closeExercisePicker() {
    setExercisePicker(null)
    setSelectedExerciseId('')
    setExerciseSearch('')
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

    if (!Number.isFinite(parsedWeightKg) || parsedWeightKg < 0) {
      setFormError('Enter a valid weight')
      return
    }

    if (!Number.isInteger(parsedReps) || parsedReps < 1) {
      setFormError('Enter valid reps')
      return
    }

    addSetMutation.mutate({
      sessionId,
      sessionExerciseId: exercise.id,
      kind,
      weightKg: parsedWeightKg,
      reps: parsedReps,
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
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <Link to={headerLink} className="text-sm font-semibold text-slate-900">
            {headerLinkLabel}
          </Link>
          <h1 className="text-[15px] font-bold text-slate-900">
            {session?.dayName ?? 'Workout'}
          </h1>
          <div className="w-[72px]" />
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
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Active workout</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-900">
                {session.dayName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Started {formatStartedAt(session.startedAt)} · {session.exercises.length} exercises
              </p>
            </div>

            <div className="space-y-3">
              {session.exercises.map((exercise, index) => {
                const isFinished = Boolean(session.endedAt)
                const activeEdit = editingSet?.exerciseId === exercise.id ? editingSet.set : null

                return (
                <article
                  key={exercise.id}
                  className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Exercise {index + 1}
                      </p>
                      <h3 className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-900">
                        {exercise.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {exercise.sets.length ? `${exercise.sets.length} sets logged` : 'No sets yet'}
                      </p>
                    </div>
                    {isFinished ? null : (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openSwapExercisePicker(exercise)}
                          className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Swap
                        </button>
                        <button
                          type="button"
                          onClick={() => openAddSetForm(exercise)}
                          className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Add Set
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveExercise(exercise)}
                          title="Remove exercise"
                          aria-label={`Remove ${exercise.name}`}
                          disabled={removeSessionExerciseMutation.isPending}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:text-slate-300"
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
                      {exercise.sets.map((set) => (
                        <SetRow
                          key={set.id}
                          set={set}
                          isFinished={isFinished}
                          onEdit={() => openEditSetForm(exercise, set)}
                          onDelete={() => handleDeleteSet(exercise, set)}
                        />
                      ))}
                    </div>
                  ) : null}
                  {!isFinished && activeExerciseId === exercise.id ? (
                    <form
                      onSubmit={(event) => handleAddSet(event, exercise)}
                      className="mt-3 rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                    >
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Add Set</p>
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Kind</span>
                          <select
                            value={kind}
                            onChange={(event) => setKind(event.target.value as SetKind)}
                            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900"
                          >
                            <option value="NORMAL">Normal</option>
                            <option value="WARMUP">Warm-up</option>
                            <option value="DROP">Drop</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Weight kg</span>
                          <input
                            type="number"
                            min="0"
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
                            min="1"
                            step="1"
                            value={reps}
                            onChange={(event) => setReps(event.target.value)}
                            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                            required
                          />
                        </label>
                      </div>
                      {formError || addSetMutation.isError ? (
                        <p className="mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                          {formError || 'Unable to add set. Please try again.'}
                        </p>
                      ) : null}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="submit"
                          disabled={addSetMutation.isPending}
                          className="rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                        >
                          {addSetMutation.isPending ? 'Saving...' : 'Save Set'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveExerciseId(null)}
                          className="rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
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
              <div className="mt-5 rounded-[14px] bg-slate-100 px-4 py-3 text-center text-sm font-medium text-slate-500">
                This workout was completed. Workout details are read-only.
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
                  disabled={finishSessionMutation.isPending}
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
                {finishSessionMutation.isError ? (
                  <p className="rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    Unable to finish workout. Please try again.
                  </p>
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </div>

      {exercisePicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="max-h-full w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                {exercisePicker.mode === 'add' ? 'Add Exercise' : 'Swap Exercise'}
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-slate-900">
                {exercisePicker.mode === 'add' ? 'Choose an exercise' : exercisePicker.sessionExercise.name}
              </h2>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-5">
              <input
                type="search"
                value={exerciseSearch}
                onChange={(event) => setExerciseSearch(event.target.value)}
                placeholder="Search exercises..."
                className="mb-4 h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-900"
              />

              {isExerciseOptionsPending ? (
                <p className="rounded-[12px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                  Loading exercises...
                </p>
              ) : null}

              {isExerciseOptionsError ? (
                <p className="rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  Unable to load exercises. Please try again.
                </p>
              ) : null}

              {!isExerciseOptionsPending && !isExerciseOptionsError && groupedExerciseOptions.length === 0 ? (
                <p className="rounded-[12px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                  No exercises match your search.
                </p>
              ) : null}

              <div className="space-y-4">
                {groupedExerciseOptions.map((group) => (
                  <section key={group.category}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      {exerciseCategoryLabels[group.category]}
                    </p>
                    <div className="space-y-2">
                      {group.exercises.map((exercise) => {
                        const isSelected = selectedExerciseId === exercise.id
                        const isCurrent =
                          exercisePicker.mode === 'swap' && exercisePicker.sessionExercise.exerciseId === exercise.id

                        return (
                          <button
                            key={exercise.id}
                            type="button"
                            onClick={() => setSelectedExerciseId(exercise.id)}
                            className={`flex w-full items-center gap-3 rounded-[14px] border px-4 py-3 text-left text-sm font-semibold transition ${
                              isSelected
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-100 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                                isSelected ? 'border-white bg-white text-slate-900' : 'border-slate-300 text-transparent'
                              }`}
                            >
                              <span className="h-2 w-2 rounded-full bg-current" />
                            </span>
                            <span className="grow">{exercise.name}</span>
                            {isCurrent ? (
                              <span className={isSelected ? 'text-xs text-white/70' : 'text-xs text-slate-400'}>
                                Current
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {exercisePickerHasError ? (
                <p className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  Unable to save exercise change. Please try again.
                </p>
              ) : null}
            </div>
            <div className="flex gap-2 border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={closeExercisePicker}
                className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExercisePickerConfirm}
                disabled={!selectedExerciseId || isCurrentSwapSelection || exercisePickerIsSaving}
                className="flex-1 rounded-[14px] bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {exercisePickerIsSaving ? 'Saving...' : exercisePicker.mode === 'add' ? 'Add Exercise' : 'Swap'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <div className="p-5">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold tracking-[-0.03em] text-slate-900">
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
            <div className="flex gap-2 border-t border-slate-100 p-4">
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
                className="flex-1 rounded-[14px] bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
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
    </main>
  )
}
