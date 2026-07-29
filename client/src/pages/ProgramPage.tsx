import type { FormEvent } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDay,
  addDayExercise,
  deleteDay,
  programQueryKey,
  removeDayExercise,
  reorderDayExercise,
  updateDay,
  getActiveProgram,
  DAY_BADGE_COLORS,
  type DayBadgeColor,
  type DayExerciseItem,
  type ProgramDay,
} from '../lib/programs'
import { dashboardQueryKey } from '../lib/dashboard'
import { exercisesQueryKey, getExercises, type ExerciseCategory } from '../lib/exercises'
import { getBadgeClass } from '../lib/badgeColors'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'

type DayModalState = { mode: 'add' } | { mode: 'edit'; day: ProgramDay } | null

type ExercisePickerState = { dayId: string } | null

type DeleteConfirmationState =
  | { type: 'day'; day: ProgramDay }
  | { type: 'exercise'; dayId: string; exercise: DayExerciseItem }
  | null

const exerciseCategoryLabels: Record<ExerciseCategory, string> = {
  CHEST: 'Chest',
  BACK: 'Back',
  SHOULDERS: 'Shoulders',
  LEGS: 'Legs',
  ARMS: 'Arms',
  CORE: 'Core',
}

const exerciseCategoryOrder: ExerciseCategory[] = ['CHEST', 'BACK', 'SHOULDERS', 'LEGS', 'ARMS', 'CORE']

function formatCategory(category: ExerciseCategory) {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

function dayCategorySubtitle(day: ProgramDay) {
  const categories = new Set(day.exercises.map((exercise) => formatCategory(exercise.category)))

  return categories.size ? [...categories].join(' + ') : 'No exercises yet'
}

export function ProgramPage() {
  const queryClient = useQueryClient()
  const [dayModal, setDayModal] = useState<DayModalState>(null)
  const [dayName, setDayName] = useState('')
  const [dayBadgeColor, setDayBadgeColor] = useState<DayBadgeColor>(DAY_BADGE_COLORS[0])
  const [dayFormError, setDayFormError] = useState('')
  const [exercisePicker, setExercisePicker] = useState<ExercisePickerState>(null)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>(null)

  const { data: program, isError, isPending } = useQuery({
    queryKey: programQueryKey,
    queryFn: getActiveProgram,
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

  const visibleExerciseOptions = exerciseOptions.filter((exercise) =>
    exercise.name.toLowerCase().includes(exerciseSearch.trim().toLowerCase()),
  )
  const groupedExerciseOptions = exerciseCategoryOrder
    .map((category) => ({
      category,
      exercises: visibleExerciseOptions.filter((exercise) => exercise.category === category),
    }))
    .filter((group) => group.exercises.length > 0)

  async function invalidateProgramData() {
    await queryClient.invalidateQueries({ queryKey: programQueryKey })
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
  }

  const addDayMutation = useMutation({
    mutationFn: addDay,
    onSuccess: async () => {
      await invalidateProgramData()
      setDayModal(null)
    },
  })
  const updateDayMutation = useMutation({
    mutationFn: updateDay,
    onSuccess: async () => {
      await invalidateProgramData()
      setDayModal(null)
    },
  })
  const deleteDayMutation = useMutation({
    mutationFn: deleteDay,
    onSuccess: async () => {
      await invalidateProgramData()
      setDeleteConfirmation(null)
    },
  })
  const addDayExerciseMutation = useMutation({
    mutationFn: addDayExercise,
    onSuccess: async () => {
      await invalidateProgramData()
      setExercisePicker(null)
      setSelectedExerciseId('')
      setExerciseSearch('')
    },
  })
  const removeDayExerciseMutation = useMutation({
    mutationFn: removeDayExercise,
    onSuccess: async () => {
      await invalidateProgramData()
      setDeleteConfirmation(null)
    },
  })
  const reorderDayExerciseMutation = useMutation({
    mutationFn: reorderDayExercise,
    onSuccess: async () => {
      await invalidateProgramData()
    },
  })

  const dayFormIsSaving = addDayMutation.isPending || updateDayMutation.isPending
  const dayFormHasError = addDayMutation.isError || updateDayMutation.isError
  const deleteConfirmationIsPending = deleteDayMutation.isPending || removeDayExerciseMutation.isPending
  const deleteConfirmationHasError = deleteDayMutation.isError || removeDayExerciseMutation.isError

  function openAddDayModal() {
    addDayMutation.reset()
    setDayModal({ mode: 'add' })
    setDayName('')
    setDayBadgeColor(DAY_BADGE_COLORS[0])
    setDayFormError('')
  }

  function openEditDayModal(day: ProgramDay) {
    updateDayMutation.reset()
    setDayModal({ mode: 'edit', day })
    setDayName(day.name)
    setDayBadgeColor((DAY_BADGE_COLORS as readonly string[]).includes(day.badgeColor)
      ? (day.badgeColor as DayBadgeColor)
      : DAY_BADGE_COLORS[0])
    setDayFormError('')
  }

  function closeDayModal() {
    if (dayFormIsSaving) {
      return
    }

    setDayModal(null)
  }

  function handleDaySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDayFormError('')

    if (!dayName.trim()) {
      setDayFormError('Enter a day name')
      return
    }

    if (!dayModal) {
      return
    }

    if (dayModal.mode === 'add') {
      addDayMutation.mutate({ name: dayName.trim(), badgeColor: dayBadgeColor })
      return
    }

    updateDayMutation.mutate({ dayId: dayModal.day.id, name: dayName.trim(), badgeColor: dayBadgeColor })
  }

  function handleDeleteDayClick(day: ProgramDay) {
    deleteDayMutation.reset()
    removeDayExerciseMutation.reset()
    setDayModal(null)
    setDeleteConfirmation({ type: 'day', day })
  }

  function openAddExercisePicker(dayId: string) {
    setExercisePicker({ dayId })
    setSelectedExerciseId('')
    setExerciseSearch('')
  }

  function closeExercisePicker() {
    setExercisePicker(null)
    setSelectedExerciseId('')
    setExerciseSearch('')
  }

  function handleExercisePickerConfirm() {
    if (!exercisePicker || !selectedExerciseId) {
      return
    }

    addDayExerciseMutation.mutate({ dayId: exercisePicker.dayId, exerciseId: selectedExerciseId })
  }

  function handleRemoveExercise(dayId: string, exercise: DayExerciseItem) {
    deleteDayMutation.reset()
    removeDayExerciseMutation.reset()
    setDeleteConfirmation({ type: 'exercise', dayId, exercise })
  }

  function closeDeleteConfirmation() {
    if (deleteConfirmationIsPending) {
      return
    }

    deleteDayMutation.reset()
    removeDayExerciseMutation.reset()
    setDeleteConfirmation(null)
  }

  function confirmDelete() {
    if (!deleteConfirmation) {
      return
    }

    if (deleteConfirmation.type === 'day') {
      deleteDayMutation.mutate({ dayId: deleteConfirmation.day.id })
      return
    }

    removeDayExerciseMutation.mutate({
      dayId: deleteConfirmation.dayId,
      dayExerciseId: deleteConfirmation.exercise.id,
    })
  }

  function handleReorder(dayId: string, exercise: DayExerciseItem, direction: 'up' | 'down') {
    reorderDayExerciseMutation.mutate({ dayId, dayExerciseId: exercise.id, direction })
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 pt-8 pb-24 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">Profile</p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">Edit Program</h1>
          </div>
          <TopNav />
          <button
            type="button"
            onClick={openAddDayModal}
            className="rounded-[13px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
          >
            + Add Day
          </button>
        </header>

        {isPending ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="text-sm font-semibold text-slate-500">Loading program...</p>
          </section>
        ) : null}

        {isError ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to load your program. Please refresh and try again.
            </p>
          </section>
        ) : null}

        {program && program.days.length === 0 ? (
          <section className="rounded-[28px] bg-white p-6 text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="text-lg font-bold text-slate-900">No days yet</p>
            <p className="mt-2 text-sm text-slate-500">Add your first day to start building your routine.</p>
          </section>
        ) : null}

        {program ? (
          <div className="space-y-3">
            {program.days.map((day) => (
              <article
                key={day.id}
                className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] ${getBadgeClass(day.badgeColor)}`}
                    >
                      {day.name}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">{dayCategorySubtitle(day)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditDayModal(day)}
                    title="Edit day"
                    aria-label={`Edit ${day.name}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
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
                </div>

                {day.exercises.length ? (
                  <div className="mt-3 rounded-[12px] bg-slate-50 px-3 py-1">
                    {day.exercises.map((exercise, index) => (
                      <div
                        key={exercise.id}
                        className="flex items-center gap-2 border-b border-slate-100 py-2 text-sm last:border-b-0"
                      >
                        <span className="cursor-grab text-slate-300">{'⠿'}</span>
                        <span className="font-medium text-slate-700">{exercise.name}</span>
                        <span className="grow" />
                        <button
                          type="button"
                          onClick={() => handleReorder(day.id, exercise, 'up')}
                          disabled={index === 0 || reorderDayExerciseMutation.isPending}
                          title="Move up"
                          aria-label={`Move ${exercise.name} up`}
                          className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-200"
                        >
                          {'↑'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorder(day.id, exercise, 'down')}
                          disabled={index === day.exercises.length - 1 || reorderDayExerciseMutation.isPending}
                          title="Move down"
                          aria-label={`Move ${exercise.name} down`}
                          className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-200"
                        >
                          {'↓'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveExercise(day.id, exercise)}
                          title="Remove exercise"
                          aria-label={`Remove ${exercise.name}`}
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
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => openAddExercisePicker(day.id)}
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    + Add exercise
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
      <BottomTabBar />

      {dayModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <form onSubmit={handleDaySubmit}>
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {dayModal.mode === 'add' ? 'Add Day' : 'Edit Day'}
                </p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-slate-900">
                  {dayModal.mode === 'add' ? 'New day' : dayModal.day.name}
                </h2>
              </div>
              <div className="max-h-[68vh] space-y-4 overflow-y-auto p-5">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Name
                  </span>
                  <input
                    type="text"
                    value={dayName}
                    onChange={(event) => setDayName(event.target.value)}
                    placeholder="e.g. PUSH"
                    className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                    required
                  />
                </label>
                <div>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Badge color
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {DAY_BADGE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setDayBadgeColor(color)}
                        aria-label={`Choose badge color ${color}`}
                        className={`h-9 w-9 rounded-full ${color} ${
                          dayBadgeColor === color ? 'ring-2 ring-offset-2 ring-slate-900' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {dayFormError || dayFormHasError ? (
                  <p className="rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    {dayFormError || 'Unable to save day. Please try again.'}
                  </p>
                ) : null}

                {dayModal.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteDayClick(dayModal.day)}
                    className="w-full rounded-[12px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100"
                  >
                    Delete Day
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-4">
                <button
                  type="button"
                  onClick={closeDayModal}
                  disabled={dayFormIsSaving}
                  className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dayFormIsSaving}
                  className="flex-1 rounded-[14px] bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {dayFormIsSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {exercisePicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="max-h-full w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Add Exercise</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-slate-900">Choose an exercise</h2>
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
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {addDayExerciseMutation.isError ? (
                <p className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  Unable to add exercise. Please try again.
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
                disabled={!selectedExerciseId || addDayExerciseMutation.isPending}
                className="flex-1 rounded-[14px] bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {addDayExerciseMutation.isPending ? 'Saving...' : 'Add Exercise'}
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
                {deleteConfirmation.type === 'day'
                  ? `Delete ${deleteConfirmation.day.name}?`
                  : `Remove ${deleteConfirmation.exercise.name}?`}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {deleteConfirmation.type === 'day'
                  ? `This deletes ${deleteConfirmation.day.name} and its ${deleteConfirmation.day.exercises.length} ${
                      deleteConfirmation.day.exercises.length === 1 ? 'exercise' : 'exercises'
                    } from your routine.`
                  : `This removes ${deleteConfirmation.exercise.name} from this day.`}
              </p>

              {deleteConfirmationHasError ? (
                <p className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {deleteConfirmation.type === 'day'
                    ? 'Unable to delete day. Please try again.'
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
                  : deleteConfirmation.type === 'day'
                    ? 'Delete Day'
                    : 'Remove Exercise'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
