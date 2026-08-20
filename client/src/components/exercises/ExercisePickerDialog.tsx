import type { FormEvent } from 'react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { createExercise, exercisesQueryKey, type ExerciseCategory, type ExerciseOption } from '../../lib/exercises'
import type { Program } from '../../lib/programs'
import { FluidSelect } from '../forms/FluidSelect'

type PickerSource = 'program' | 'all'

type ExercisePickerDialogProps = {
  mode: 'add' | 'swap'
  currentExerciseName?: string
  exerciseOptions: ExerciseOption[]
  program?: Program | null
  programIsPending?: boolean
  programIsError?: boolean
  targetDayId?: string
  existingExerciseIds: string[]
  currentExerciseId?: string
  selectedExerciseId: string
  isOptionsPending: boolean
  isOptionsError: boolean
  isSaving: boolean
  saveError?: string
  onSelectedExercise: (exerciseId: string) => void
  onConfirm: () => void
  onClose: () => void
  onCreated: (exercise: ExerciseOption) => void
}

const categoryLabels: Record<ExerciseCategory, string> = {
  CHEST: 'Chest',
  BACK: 'Back',
  SHOULDERS: 'Shoulders',
  LEGS: 'Legs',
  ARMS: 'Arms',
  CORE: 'Core',
}

const categoryOrder: ExerciseCategory[] = ['CHEST', 'BACK', 'SHOULDERS', 'LEGS', 'ARMS', 'CORE']

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback
  }

  return fallback
}

function NewExerciseForm({
  isSaving,
  error,
  onCancel,
  onSubmit,
}: {
  isSaving: boolean
  error?: string
  onCancel: () => void
  onSubmit: (name: string, category: ExerciseCategory) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('CHEST')
  const [formError, setFormError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setFormError('Enter an exercise name')
      return
    }

    setFormError('')
    onSubmit(trimmedName, category)
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Exercise library</p>
        <h2 id="new-exercise-dialog-title" className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-slate-900">
          New Exercise
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Create a custom exercise you can add to any workout or Program.</p>
      </div>
      <div className="min-h-0 overflow-y-auto p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="e.g. Cable Fly"
            className="h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-900"
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Category</span>
          <FluidSelect
            value={category}
            options={categoryOrder.map((option) => ({ value: option, label: categoryLabels[option] }))}
            onValueChange={(nextCategory) => setCategory(nextCategory as ExerciseCategory)}
            ariaLabel="Exercise category"
          />
        </label>
        {formError || error ? (
          <p className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError || error}</p>
        ) : null}
      </div>
      <div className="flex gap-2 border-t border-slate-100 p-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 rounded-[14px] bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
        >
          {isSaving ? 'Saving...' : 'Save Exercise'}
        </button>
      </div>
    </form>
  )
}

export function ExercisePickerDialog({
  mode,
  currentExerciseName,
  exerciseOptions,
  program,
  programIsPending = false,
  programIsError = false,
  targetDayId,
  existingExerciseIds,
  currentExerciseId,
  selectedExerciseId,
  isOptionsPending,
  isOptionsError,
  isSaving,
  saveError,
  onSelectedExercise,
  onConfirm,
  onClose,
  onCreated,
}: ExercisePickerDialogProps) {
  const queryClient = useQueryClient()
  const [source, setSource] = useState<PickerSource>('program')
  const [search, setSearch] = useState('')
  const [isNewExerciseOpen, setIsNewExerciseOpen] = useState(false)
  const createMutation = useMutation({
    mutationFn: createExercise,
    onSuccess: (exercise) => {
      queryClient.setQueryData<ExerciseOption[]>(exercisesQueryKey, (current = []) =>
        [...current, exercise].sort((left, right) => left.name.localeCompare(right.name)),
      )
      setIsNewExerciseOpen(false)
      setSource('all')
      setSearch('')
      onCreated(exercise)
    },
  })

  const existingIds = new Set(existingExerciseIds)
  const programGroups = [...(program?.days ?? [])]
    .sort((left, right) => {
      if (left.id === targetDayId) return -1
      if (right.id === targetDayId) return 1
      return left.order - right.order
    })
    .map((day) => {
      const seen = new Set<string>()
      const exercises = day.exercises
        .filter((exercise) => {
          if (seen.has(exercise.exerciseId)) {
            return false
          }

          seen.add(exercise.exerciseId)
          return true
        })
        .map((exercise) => ({
          id: exercise.exerciseId,
          name: exercise.name,
          category: exercise.category,
          isCustom: false,
        }))

      return { id: day.id, label: day.name, exercises }
    })
  const allGroups = categoryOrder.map((category) => ({
    id: category,
    label: categoryLabels[category],
    exercises: exerciseOptions.filter((exercise) => exercise.category === category),
  }))
  const groups = source === 'program' ? programGroups : allGroups
  const normalizedSearch = search.trim().toLowerCase()
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      exercises: group.exercises.filter((exercise) => exercise.name.toLowerCase().includes(normalizedSearch)),
    }))
    .filter((group) => group.exercises.length > 0)
  const isSourcePending = source === 'program' ? programIsPending : isOptionsPending
  const isSourceError = source === 'program' ? programIsError : isOptionsError

  function selectSource(nextSource: PickerSource) {
    setSource(nextSource)
    setSearch('')
    onSelectedExercise('')
  }

  function handleCreate(name: string, category: ExerciseCategory) {
    createMutation.mutate({ name, category })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isSaving && !createMutation.isPending) {
          if (isNewExerciseOpen) {
            setIsNewExerciseOpen(false)
            createMutation.reset()
          } else {
            onClose()
          }
        }
      }}
    >
      {isNewExerciseOpen ? (
        <NewExerciseForm
          isSaving={createMutation.isPending}
          error={createMutation.isError ? getErrorMessage(createMutation.error, 'Unable to save exercise. Please try again.') : undefined}
          onCancel={() => {
            createMutation.reset()
            setIsNewExerciseOpen(false)
          }}
          onSubmit={handleCreate}
        />
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exercise-picker-dialog-title"
          className="flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]"
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {mode === 'add' ? 'Add Exercise' : 'Swap Exercise'}
            </p>
            <h2 id="exercise-picker-dialog-title" className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-slate-900">
              {mode === 'add' ? 'Choose an exercise' : currentExerciseName}
            </h2>
          </div>
          <div className="min-h-0 overflow-y-auto p-5">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search exercises..."
              className="h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-900"
            />
            <div className="my-4 flex gap-1 rounded-[12px] bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => selectSource('program')}
                className={`min-h-10 flex-1 rounded-[9px] px-3 py-2 text-xs font-bold transition ${source === 'program' ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.1)]' : 'text-slate-500'}`}
              >
                Program days
              </button>
              <button
                type="button"
                onClick={() => selectSource('all')}
                className={`min-h-10 flex-1 rounded-[9px] px-3 py-2 text-xs font-bold transition ${source === 'all' ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.1)]' : 'text-slate-500'}`}
              >
                All exercises
              </button>
            </div>

            {isSourcePending ? (
              <p className="rounded-[12px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">Loading exercises...</p>
            ) : null}
            {isSourceError ? (
              <p className="rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Unable to load exercises. Please try again.</p>
            ) : null}
            {!isSourcePending && !isSourceError && visibleGroups.length === 0 ? (
              <p className="rounded-[12px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                {source === 'program' && !program?.days.length ? 'Your Program has no exercises yet.' : 'No exercises match your search.'}
              </p>
            ) : null}

            <div className="space-y-4">
              {visibleGroups.map((group) => (
                <section key={group.id}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{group.label}</p>
                  <div className="space-y-2">
                    {group.exercises.map((exercise) => {
                      const isCurrent = currentExerciseId === exercise.id
                      const isAdded = existingIds.has(exercise.id) && !isCurrent
                      const isSelected = selectedExerciseId === exercise.id
                      const isDisabled = isAdded

                      return (
                        <button
                          key={`${group.id}-${exercise.id}`}
                          type="button"
                          onClick={() => onSelectedExercise(exercise.id)}
                          disabled={isDisabled}
                          aria-pressed={isSelected}
                          className={`flex w-full items-center gap-3 rounded-[14px] border px-4 py-3 text-left text-sm font-semibold transition ${
                            isDisabled
                              ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                              : isSelected
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
                          {exercise.isCustom ? <span className={isSelected ? 'text-xs text-white/70' : 'text-xs text-slate-400'}>Yours</span> : null}
                          {isCurrent ? <span className={isSelected ? 'text-xs text-white/70' : 'text-xs text-slate-400'}>Current</span> : null}
                          {isAdded ? <span className="text-xs text-slate-400">Added</span> : null}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            {saveError ? <p className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{saveError}</p> : null}
            <button
              type="button"
              onClick={() => {
                createMutation.reset()
                setIsNewExerciseOpen(true)
              }}
              className="mt-5 min-h-11 w-full rounded-[14px] border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-slate-500 hover:bg-slate-50"
            >
              + New Exercise
            </button>
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!selectedExerciseId || isSaving || selectedExerciseId === currentExerciseId}
              className="flex-1 rounded-[14px] bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isSaving ? 'Saving...' : mode === 'add' ? 'Add Exercise' : 'Swap'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
