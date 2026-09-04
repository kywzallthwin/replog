import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  addDay,
  addDayExercise,
  activateProgram,
  deleteDay,
  deleteProgram,
  programQueryKey,
  activeProgramQueryKey,
  programsQueryKey,
  removeDayExercise,
  reorderDayExercise,
  updateDay,
  getProgram,
  getProgramMutationError,
  DAY_BADGE_COLORS,
  type DayBadgeColor,
  type DayExerciseItem,
  type Program,
  type ProgramDay,
} from '../lib/programs'
import { dashboardQueryKey, getDashboard } from '../lib/dashboard'
import { exercisesQueryKey, getExercises } from '../lib/exercises'
import { getBadgeClass } from '../lib/badgeColors'
import { ExercisePickerDialog } from '../components/exercises/ExercisePickerDialog'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'
import { BrandLogo } from '../components/BrandLogo'
import { ProgramActionsMenu } from '../components/programs/ProgramActionsMenu'
import { ProgramDeleteDialog } from '../components/programs/ProgramDeleteDialog'
import { Dialog } from '../components/ui/Dialog'
import { PageLoader } from '../components/ui/PageLoader'

type DayModalState = { mode: 'add' } | { mode: 'edit'; day: ProgramDay } | null

type ExercisePickerState = { dayId: string } | null

type DeleteConfirmationState =
  | { type: 'day'; day: ProgramDay }
  | { type: 'exercise'; dayId: string; exercise: DayExerciseItem }
  | null

function formatCategory(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

function dayCategorySubtitle(day: ProgramDay) {
  const categories = new Set(day.exercises.map((exercise) => formatCategory(exercise.category)))

  return categories.size ? [...categories].join(' + ') : 'No exercises yet'
}

type SortableExerciseRowProps = {
  exercise: DayExerciseItem
  isReordering: boolean
  onRemove: () => void
}

function SortableExerciseRow({ exercise, isReordering, onRemove }: SortableExerciseRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id, disabled: isReordering })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex items-center gap-2 border-b border-slate-100 py-2 text-sm last:border-b-0 ${
        isDragging ? 'relative z-10 rounded-[10px] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.12)]' : ''
      }`}
    >
      <span className="min-w-0 grow break-words font-medium text-slate-700">{exercise.name}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={isReordering}
        data-press="icon"
        data-press-tone="red"
        title="Remove exercise"
        aria-label={`Remove ${exercise.name}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500"
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
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={isReordering}
        data-press="icon"
        data-press-tone="slate"
        title="Drag to reorder"
        aria-label={`Drag ${exercise.name} to reorder`}
        className="grid h-11 w-11 shrink-0 cursor-grab place-items-center rounded-full text-slate-300 transition hover:bg-slate-200 hover:text-slate-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:text-slate-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="18" viewBox="0 0 14 18" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="2" r="1.25" />
          <circle cx="11" cy="2" r="1.25" />
          <circle cx="3" cy="9" r="1.25" />
          <circle cx="11" cy="9" r="1.25" />
          <circle cx="3" cy="16" r="1.25" />
          <circle cx="11" cy="16" r="1.25" />
        </svg>
      </button>
    </div>
  )
}

export function ProgramPage() {
  const { programId: routeProgramId } = useParams<{ programId: string }>()
  const programId = routeProgramId ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dayModal, setDayModal] = useState<DayModalState>(null)
  const [dayName, setDayName] = useState('')
  const [dayBadgeColor, setDayBadgeColor] = useState<DayBadgeColor>(DAY_BADGE_COLORS[0])
  const [dayFormError, setDayFormError] = useState('')
  const [exercisePicker, setExercisePicker] = useState<ExercisePickerState>(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>(null)
  const [activationBlocked, setActivationBlocked] = useState(false)
  const [activationError, setActivationError] = useState('')
  const [programDeleteDialogOpen, setProgramDeleteDialogOpen] = useState(false)
  const [programMenuOpen, setProgramMenuOpen] = useState(false)
  const dayModalTriggerRef = useRef<HTMLElement | null>(null)
  const exercisePickerTriggerRef = useRef<HTMLElement | null>(null)
  const deleteConfirmationTriggerRef = useRef<HTMLElement | null>(null)
  const addDayButtonRef = useRef<HTMLButtonElement>(null)

  const { data: program, isError, isPending } = useQuery({
    queryKey: programQueryKey(programId),
    queryFn: () => getProgram(programId),
    retry: false,
    enabled: Boolean(programId),
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
  const { data: dashboard } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: getDashboard,
    retry: false,
  })

  async function invalidateProgramData() {
    await queryClient.invalidateQueries({ queryKey: programQueryKey(programId) })
    await queryClient.invalidateQueries({ queryKey: programsQueryKey })
    await queryClient.invalidateQueries({ queryKey: activeProgramQueryKey })
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
  }

  const activateProgramMutation = useMutation({
    mutationFn: () => activateProgram(programId),
    onSuccess: async () => {
      setActivationBlocked(false)
      setActivationError('')
      await invalidateProgramData()
    },
    onError: (error) => {
      setActivationBlocked(true)
      setActivationError(getProgramMutationError(error, 'Finish or cancel the active workout before switching programs.', 'Unable to activate this program. Please try again.'))
    },
  })
  const deleteProgramMutation = useMutation({
    mutationFn: () => deleteProgram(programId),
    onSuccess: async () => {
      await invalidateProgramData()
      setProgramDeleteDialogOpen(false)
       navigate('/program', { state: { focus: 'programs-heading' } })
    },
  })

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
    onMutate: async ({ dayId, dayExerciseId, targetIndex }) => {
      await queryClient.cancelQueries({ queryKey: programQueryKey(programId) })
      const previousProgram = queryClient.getQueryData<Program | null>(programQueryKey(programId))

      queryClient.setQueryData<Program | null>(programQueryKey(programId), (currentProgram) => {
        if (!currentProgram) {
          return currentProgram
        }

        return {
          ...currentProgram,
          days: currentProgram.days.map((day) => {
            if (day.id !== dayId) {
              return day
            }

            const sourceIndex = day.exercises.findIndex((exercise) => exercise.id === dayExerciseId)
            if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= day.exercises.length) {
              return day
            }

            return {
              ...day,
              exercises: arrayMove(day.exercises, sourceIndex, targetIndex).map((exercise, index) => ({
                ...exercise,
                order: index + 1,
              })),
            }
          }),
        }
      })

      return { previousProgram }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProgram !== undefined) {
        queryClient.setQueryData(programQueryKey(programId), context.previousProgram)
      }
    },
    onSuccess: async (exercises, { dayId }) => {
      queryClient.setQueryData<Program | null>(programQueryKey(programId), (currentProgram) => {
        if (!currentProgram) {
          return currentProgram
        }

        return {
          ...currentProgram,
          days: currentProgram.days.map((day) => day.id === dayId ? { ...day, exercises } : day),
        }
      })
      await invalidateProgramData()
    },
  })

  const dayFormIsSaving = addDayMutation.isPending || updateDayMutation.isPending
  const dayFormHasError = addDayMutation.isError || updateDayMutation.isError
  const deleteConfirmationIsPending = deleteDayMutation.isPending || removeDayExerciseMutation.isPending
  const deleteConfirmationHasError = deleteDayMutation.isError || removeDayExerciseMutation.isError
  const editorMutationIsPending = activateProgramMutation.isPending
    || dayFormIsSaving
    || deleteConfirmationIsPending
    || addDayExerciseMutation.isPending
    || reorderDayExerciseMutation.isPending

  function openAddDayModal(trigger?: HTMLElement) {
    if (editorMutationIsPending) {
      return
    }

    if (trigger) {
      dayModalTriggerRef.current = trigger
    }

    addDayMutation.reset()
    setDayModal({ mode: 'add' })
    setDayName('')
    setDayBadgeColor(DAY_BADGE_COLORS[0])
    setDayFormError('')
  }

  function openEditDayModal(day: ProgramDay, trigger?: HTMLElement) {
    if (editorMutationIsPending) {
      return
    }

    if (trigger) {
      dayModalTriggerRef.current = trigger
    }

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
      addDayMutation.mutate({ programId, name: dayName.trim(), badgeColor: dayBadgeColor })
      return
    }

    updateDayMutation.mutate({ programId, dayId: dayModal.day.id, name: dayName.trim(), badgeColor: dayBadgeColor })
  }

  function handleDeleteDayClick(day: ProgramDay) {
    if (editorMutationIsPending) {
      return
    }

    deleteDayMutation.reset()
    removeDayExerciseMutation.reset()
    deleteConfirmationTriggerRef.current = dayModalTriggerRef.current
    setDayModal(null)
    setDeleteConfirmation({ type: 'day', day })
  }

  function openAddExercisePicker(dayId: string, trigger?: HTMLElement) {
    if (editorMutationIsPending) {
      return
    }

    if (trigger) {
      exercisePickerTriggerRef.current = trigger
    }

    addDayExerciseMutation.reset()
    setExercisePicker({ dayId })
    setSelectedExerciseId('')
  }

  function closeExercisePicker() {
    setExercisePicker(null)
    setSelectedExerciseId('')
  }

  function handleExercisePickerConfirm() {
    if (!exercisePicker || !selectedExerciseId) {
      return
    }

    addDayExerciseMutation.mutate({ programId, dayId: exercisePicker.dayId, exerciseId: selectedExerciseId })
  }

  function handleRemoveExercise(dayId: string, exercise: DayExerciseItem) {
    if (editorMutationIsPending) {
      return
    }

    deleteDayMutation.reset()
    removeDayExerciseMutation.reset()
    deleteConfirmationTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
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
      deleteDayMutation.mutate({ programId, dayId: deleteConfirmation.day.id })
      return
    }

    removeDayExerciseMutation.mutate({
      programId,
      dayId: deleteConfirmation.dayId,
      dayExerciseId: deleteConfirmation.exercise.id,
    })
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(day: ProgramDay, event: DragEndEvent) {
    if (editorMutationIsPending || !event.over || event.active.id === event.over.id) {
      return
    }

    const sourceIndex = day.exercises.findIndex((exercise) => exercise.id === String(event.active.id))
    const targetIndex = day.exercises.findIndex((exercise) => exercise.id === String(event.over?.id))

    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }

    reorderDayExerciseMutation.reset()
    reorderDayExerciseMutation.mutate({
      programId,
      dayId: day.id,
      dayExerciseId: String(event.active.id),
      targetIndex,
    })
  }

  function handleActivateProgram() {
    if (activateProgramMutation.isPending) {
      return
    }

    if (dashboard?.activeSession) {
      activateProgramMutation.reset()
      setActivationBlocked(true)
      setActivationError('Finish or cancel the active workout before switching programs.')
      return
    }

    setActivationBlocked(false)
    setActivationError('')
    activateProgramMutation.reset()
    activateProgramMutation.mutate()
  }

  function openProgramDeleteDialog() {
    if (editorMutationIsPending) {
      return
    }

    deleteProgramMutation.reset()
    setProgramMenuOpen(false)
    setProgramDeleteDialogOpen(true)
  }

  return (
    <main className="min-h-dvh bg-slate-100 px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/program"
              aria-label="Back to programs"
              className="inline-flex min-h-11 items-center"
            >
              <BrandLogo className="h-6 w-auto" />
            </Link>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Program editor</p>
             <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">
              {program?.name ?? 'Edit Program'}
            </h1>
          </div>
          <TopNav />
          <div className="flex items-center gap-2">
            {program && !program.isActive ? (
              <button
                type="button"
                onClick={handleActivateProgram}
                 disabled={activateProgramMutation.isPending || editorMutationIsPending}
                className="min-h-11 rounded-[13px] border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {activateProgramMutation.isPending ? 'Activating...' : 'Make active'}
              </button>
            ) : null}
            {program ? (
              <ProgramActionsMenu
                programName={program.name}
                isOpen={programMenuOpen}
                onToggle={() => setProgramMenuOpen((isOpen) => !isOpen)}
                onDelete={openProgramDeleteDialog}
                deleteDisabled={program.isActive || deleteProgramMutation.isPending}
                disabled={editorMutationIsPending || activateProgramMutation.isPending || deleteProgramMutation.isPending}
              />
            ) : null}
              <button
                ref={addDayButtonRef}
                type="button"
                onClick={(event) => openAddDayModal(event.currentTarget)}
                disabled={!program || editorMutationIsPending}
              className="min-h-11 rounded-[13px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              + Add Day
            </button>
          </div>
        </header>

        {activationBlocked || activateProgramMutation.isError ? (
          <p role="alert" className="mb-4 rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
             {activationError || 'Finish or cancel the active workout before switching programs.'}
          </p>
        ) : null}

        {program?.isActive ? (
          <p className="mb-4 text-xs font-semibold text-slate-400">Activate another program before deleting this one.</p>
        ) : null}

        {isPending ? (
          <PageLoader statusMessage="Loading program..." />
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
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                       className={`max-w-[55%] break-words rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] [overflow-wrap:anywhere] ${getBadgeClass(day.badgeColor)}`}
                    >
                      {day.name}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold text-slate-500">{dayCategorySubtitle(day)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => openEditDayModal(day, event.currentTarget)}
                    disabled={editorMutationIsPending}
                    data-press="icon"
                    data-press-tone="blue"
                    title="Edit day"
                    aria-label={`Edit ${day.name}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(day, event)}
                  >
                    <SortableContext
                      items={day.exercises.map((exercise) => exercise.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="mt-3 rounded-[12px] bg-slate-50 px-3 py-1">
                        {day.exercises.map((exercise) => (
                          <SortableExerciseRow
                            key={exercise.id}
                            exercise={exercise}
                            isReordering={editorMutationIsPending}
                            onRemove={() => handleRemoveExercise(day.id, exercise)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : null}

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={(event) => openAddExercisePicker(day.id, event.currentTarget)}
                    disabled={editorMutationIsPending}
                    className="min-h-11 w-full rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    + Add exercise
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {reorderDayExerciseMutation.isPending ? (
          <p role="status" aria-live="polite" className="mt-4 rounded-[10px] bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
            Reordering exercise...
          </p>
        ) : null}

        {reorderDayExerciseMutation.isError ? (
          <p role="alert" className="mt-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Unable to reorder the exercise. Please try again.
          </p>
        ) : null}
      </div>
      <BottomTabBar />

      {dayModal ? (
        <Dialog
          labelledBy="program-day-dialog-title"
          onClose={closeDayModal}
          closeOnEscape={!dayFormIsSaving}
          restoreFocusRef={dayModalTriggerRef}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
          className="flex max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]"
        >
          <form onSubmit={handleDaySubmit} className="flex min-h-0 flex-col">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                {dayModal.mode === 'add' ? 'Add Day' : 'Edit Day'}
              </p>
               <h2 id="program-day-dialog-title" className="mt-1 break-words text-xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">
                {dayModal.mode === 'add' ? 'New day' : dayModal.day.name}
              </h2>
            </div>
            <div className="min-h-0 space-y-4 overflow-y-auto p-5">
              <label htmlFor="program-day-name" className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Name
                </span>
                <input
                  id="program-day-name"
                  type="text"
                  aria-describedby={dayFormError || dayFormHasError ? 'program-day-error' : undefined}
                  maxLength={60}
                  value={dayName}
                  disabled={dayFormIsSaving}
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
                       disabled={dayFormIsSaving}
                      data-press="swatch"
                      aria-label={`Choose badge color ${color}`}
                      aria-pressed={dayBadgeColor === color}
                      className={`h-11 w-11 rounded-full ${color} ${
                        dayBadgeColor === color ? 'ring-2 ring-offset-2 ring-slate-900' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              {dayFormError || dayFormHasError ? (
                <p id="program-day-error" role="alert" className="rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {dayFormError || 'Unable to save day. Please try again.'}
                </p>
              ) : null}

              {dayModal.mode === 'edit' ? (
                <button
                   type="button"
                   onClick={() => handleDeleteDayClick(dayModal.day)}
                   disabled={dayFormIsSaving}
                   className="min-h-11 w-full rounded-[12px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                className="min-h-11 flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dayFormIsSaving}
                className="min-h-11 flex-1 rounded-[14px] bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {dayFormIsSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {exercisePicker ? (
        <ExercisePickerDialog
          mode="add"
          exerciseOptions={exerciseOptions}
          program={program}
          programIsPending={isPending}
          programIsError={isError}
          targetDayId={exercisePicker.dayId}
          existingExerciseIds={program?.days.find((day) => day.id === exercisePicker.dayId)?.exercises.map((exercise) => exercise.exerciseId) ?? []}
          selectedExerciseId={selectedExerciseId}
          isOptionsPending={isExerciseOptionsPending}
          isOptionsError={isExerciseOptionsError}
          isSaving={addDayExerciseMutation.isPending}
          saveError={addDayExerciseMutation.isError ? 'Unable to add exercise. Please try again.' : undefined}
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
          labelledBy="program-delete-dialog-title"
          describedBy="program-delete-dialog-description"
          onClose={closeDeleteConfirmation}
          closeOnEscape={!deleteConfirmationIsPending}
           restoreFocusRef={deleteConfirmationTriggerRef}
           fallbackFocusRef={addDayButtonRef}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
          className="max-h-[calc(100dvh-2rem)] w-full max-w-[335px] overflow-y-auto rounded-[22px] bg-white p-[18px] shadow-[0_22px_60px_rgba(15,23,42,0.28)]"
        >
          <div>
             <h2 id="program-delete-dialog-title" className="break-words text-xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">
              {deleteConfirmation.type === 'day'
                ? `Delete ${deleteConfirmation.day.name}?`
                : `Remove ${deleteConfirmation.exercise.name}?`}
            </h2>
             <p id="program-delete-dialog-description" className="mt-2 break-words text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
              {deleteConfirmation.type === 'day'
                ? `This deletes ${deleteConfirmation.day.name} and its ${deleteConfirmation.day.exercises.length} ${
                    deleteConfirmation.day.exercises.length === 1 ? 'exercise' : 'exercises'
                  } from your routine.`
                : `This removes ${deleteConfirmation.exercise.name} from this day.`}
            </p>

            {deleteConfirmationHasError ? (
              <p role="alert" className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {deleteConfirmation.type === 'day'
                  ? 'Unable to delete day. Please try again.'
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
                : deleteConfirmation.type === 'day'
                  ? 'Delete Day'
                  : 'Remove Exercise'}
            </button>
          </div>
        </Dialog>
       ) : null}

      {programDeleteDialogOpen && program ? (
        <ProgramDeleteDialog
          program={{
            id: program.id,
            name: program.name,
            isActive: program.isActive,
            dayCount: program.days.length,
            exerciseCount: program.days.reduce((count, day) => count + day.exercises.length, 0),
          }}
          isDeleting={deleteProgramMutation.isPending}
          error={deleteProgramMutation.isError ? 'Unable to delete this program. Please try again.' : undefined}
          onCancel={() => {
            if (!deleteProgramMutation.isPending) {
              deleteProgramMutation.reset()
              setProgramDeleteDialogOpen(false)
            }
          }}
          onConfirm={() => deleteProgramMutation.mutate()}
        />
      ) : null}
    </main>
  )
}
