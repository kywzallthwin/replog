import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import { createCategory, createExercise, deleteCategory, exercisesQueryKey, categoriesQueryKey, getCategories, recategorizeExercise, renameCategory, resetCategoryLabel, type CategorySummary, type ExerciseOption } from '../../lib/exercises'
import { dashboardQueryKey } from '../../lib/dashboard'
import { programsQueryKey } from '../../lib/programs'
import type { Program } from '../../lib/programs'
import { FluidSelect } from '../forms/FluidSelect'
import { Dialog } from '../ui/Dialog'

type PickerSource = 'program' | 'all'

const EMPTY_CATEGORIES: CategorySummary[] = []

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
  restoreFocusRef?: RefObject<HTMLElement | null>
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback
  }

  return fallback
}

function NewExerciseForm({
  categories,
  isSaving,
  error,
  onCancel,
  onSubmit,
}: {
  categories: CategorySummary[]
  isSaving: boolean
  error?: string
  onCancel: () => void
  onSubmit: (name: string, categoryId: string) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [formError, setFormError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setFormError('Enter an exercise name')
      return
    }

    if (!category) { setFormError('Choose a category'); return }
    setFormError('')
    onSubmit(trimmedName, category)
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isSaving || undefined} className="flex min-h-0 w-full flex-col overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Exercise library</p>
        <h2 id="new-exercise-dialog-title" className="mt-1 break-words text-xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">
          New Exercise
        </h2>
        <p id="new-exercise-dialog-description" className="mt-2 break-words text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
          Create a custom exercise you can add to any workout or Program.
        </p>
      </div>
      <div className="min-h-0 overflow-y-auto p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Name</span>
          <input
            autoFocus
            value={name}
            disabled={isSaving}
            onChange={(event) => setName(event.target.value)}
            aria-describedby={formError || error ? 'new-exercise-error' : undefined}
            maxLength={80}
            placeholder="e.g. Cable Fly"
            className="h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-900"
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Category</span>
          <FluidSelect
            value={category}
            disabled={isSaving}
            options={categories.map((option) => ({ value: option.id, label: option.name }))}
            onValueChange={setCategory}
            ariaLabel="Exercise category"
          />
        </label>
        {formError || error ? (
          <p id="new-exercise-error" role="alert" className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {formError || error}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2 border-t border-slate-100 p-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="min-h-11 flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="min-h-11 flex-1 rounded-[14px] bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
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
  restoreFocusRef,
}: ExercisePickerDialogProps) {
  const queryClient = useQueryClient()
  const pickerId = useId()
  const newExerciseTriggerRef = useRef<HTMLButtonElement>(null)
  const categoryManagerTriggerRef = useRef<HTMLButtonElement>(null)
  const categoryRenameButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const programTabRef = useRef<HTMLButtonElement>(null)
  const allExercisesTabRef = useRef<HTMLButtonElement>(null)
  const [source, setSource] = useState<PickerSource>('program')
  const [search, setSearch] = useState('')
  const [isNewExerciseOpen, setIsNewExerciseOpen] = useState(false)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryManagerMode, setCategoryManagerMode] = useState<'rename' | 'delete' | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [replacementId, setReplacementId] = useState('')
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState('')
  const refreshLibrary = () => {
    void queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
    void queryClient.invalidateQueries({ queryKey: exercisesQueryKey })
    void queryClient.invalidateQueries({ queryKey: programsQueryKey })
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    void queryClient.invalidateQueries({ queryKey: ['progress'] })
  }
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
  const categoriesQuery = useQuery({ queryKey: categoriesQueryKey, queryFn: getCategories })
  const categories = categoriesQuery.data ?? EMPTY_CATEGORIES
  useEffect(() => {
    if (!isCategoryManagerOpen) return
    for (const category of categories) {
      const name = Array.from(document.querySelectorAll('span')).find((element) => element.textContent === category.name)
      const button = name?.parentElement?.querySelector('button')
      if (button instanceof HTMLButtonElement) categoryRenameButtonRefs.current[category.id] = button
    }
  }, [categories, isCategoryManagerOpen])
  const categoryMutation = useMutation({ mutationFn: ({ name, id }: { name: string; id?: string }) => id ? renameCategory(id, name) : createCategory(name), onSuccess: (category, variables) => { queryClient.setQueryData<CategorySummary[]>(categoriesQueryKey, (current = []) => variables.id ? current.map((item) => item.id === category.id ? category : item) : [...current, category]); setCategoryName(''); setRenameDraft(''); setMutationError(''); refreshLibrary(); setSelectedCategoryId(null); setCategoryManagerMode(null); if (variables.id) window.requestAnimationFrame(() => categoryRenameButtonRefs.current[variables.id!]?.focus()) }, onError: (error) => setMutationError(getErrorMessage(error, 'Unable to save category.')) })
  const deleteMutation = useMutation({ mutationFn: ({ id, replacement }: { id: string; replacement: string }) => deleteCategory(id, replacement), onSuccess: () => { setReplacementId(''); setSelectedCategoryId(null); setCategoryManagerMode(null); setMutationError(''); refreshLibrary(); window.requestAnimationFrame(() => categoryManagerTriggerRef.current?.focus()) }, onError: (error) => setMutationError(getErrorMessage(error, 'Unable to delete category.')) })
  const resetLabelMutation = useMutation({ mutationFn: resetCategoryLabel, onSuccess: (_data, categoryId) => { setSelectedCategoryId(null); setCategoryManagerMode(null); setMutationError(''); refreshLibrary(); window.requestAnimationFrame(() => categoryRenameButtonRefs.current[categoryId]?.focus()) }, onError: (error) => setMutationError(getErrorMessage(error, 'Unable to reset category name.')) })
  const recategorizeMutation = useMutation({ mutationFn: ({ exerciseId, categoryId }: { exerciseId: string; categoryId: string }) => recategorizeExercise(exerciseId, categoryId), onSuccess: (exercise) => { queryClient.setQueryData<ExerciseOption[]>(exercisesQueryKey, (current = []) => current.map((item) => item.id === exercise.id ? exercise : item)); setEditingExerciseId(null); setMutationError(''); refreshLibrary() }, onError: (error) => setMutationError(getErrorMessage(error, 'Unable to change category.')) })

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
  const allGroups = categories.map((category) => ({
    id: category.id,
    label: category.name,
    exercises: exerciseOptions.filter((exercise) => exercise.category.id === category.id),
  }))
  const groups = source === 'program' ? programGroups : allGroups
  const normalizedSearch = search.trim().toLowerCase()
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      exercises: group.exercises.filter((exercise) =>
        `${exercise.name} ${exercise.category.name}`.toLowerCase().includes(normalizedSearch),
      ),
    }))
    .filter((group) => group.exercises.length > 0)
  const isSourcePending = source === 'program' ? programIsPending : isOptionsPending
  const isSourceError = source === 'program' ? programIsError : isOptionsError
  const hasSourceExercises = groups.some((group) => group.exercises.length > 0)
  const pickerIsBusy = isSaving || createMutation.isPending

  function selectSource(nextSource: PickerSource) {
    if (pickerIsBusy) {
      return
    }

    setSource(nextSource)
    setSearch('')
    onSelectedExercise('')
  }

  function handleSourceTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentSource: PickerSource) {
    const nextSource = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? currentSource === 'program' ? 'all' : 'program'
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? currentSource === 'program' ? 'all' : 'program'
        : event.key === 'Home'
          ? 'program'
          : event.key === 'End'
            ? 'all'
            : null

    if (!nextSource) {
      return
    }

    event.preventDefault()
    selectSource(nextSource)
    const nextTabRef = nextSource === 'program' ? programTabRef : allExercisesTabRef
    nextTabRef.current?.focus()
  }

  function handleCreate(name: string, categoryId: string) {
    createMutation.mutate({ name, categoryId })
  }

  function closeNewExercise() {
    if (createMutation.isPending) {
      return
    }

    createMutation.reset()
    setIsNewExerciseOpen(false)
    window.requestAnimationFrame(() => newExerciseTriggerRef.current?.focus())
  }

  function handleDialogClose() {
    if (isSaving || createMutation.isPending) {
      return
    }

    if (isNewExerciseOpen) {
      closeNewExercise()
      return
    }

    if (isCategoryManagerOpen) {
      setIsCategoryManagerOpen(false)
      setCategoryManagerMode(null)
      setSelectedCategoryId(null)
      window.requestAnimationFrame(() => categoryManagerTriggerRef.current?.focus())
      return
    }

    onClose()
  }

  function closeCategoryEditor() {
    const categoryId = selectedCategoryId
    setCategoryManagerMode(null)
    setSelectedCategoryId(null)
    setRenameDraft('')
    if (categoryId) window.requestAnimationFrame(() => categoryRenameButtonRefs.current[categoryId]?.focus())
  }

  return (
    <Dialog
      labelledBy={isNewExerciseOpen ? 'new-exercise-dialog-title' : isCategoryManagerOpen ? 'category-manager-title' : 'exercise-picker-dialog-title'}
      describedBy={isNewExerciseOpen ? 'new-exercise-dialog-description' : undefined}
      onClose={handleDialogClose}
      restoreFocusRef={restoreFocusRef}
      focusKey={isNewExerciseOpen ? 'new-exercise' : isCategoryManagerOpen ? 'category-manager' : 'exercise-picker'}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
      className="flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]"
    >
      {isNewExerciseOpen ? (
        <NewExerciseForm
          categories={categories}
          isSaving={createMutation.isPending}
          error={createMutation.isError ? getErrorMessage(createMutation.error, 'Unable to save exercise. Please try again.') : undefined}
          onCancel={closeNewExercise}
          onSubmit={handleCreate}
        />
      ) : isCategoryManagerOpen ? (
        <div className="flex max-h-[calc(100dvh-3rem)] min-h-0 w-full flex-col">
          <div className="border-b border-slate-100 px-5 py-4"><h2 id="category-manager-title" className="text-xl font-extrabold text-slate-900">Manage categories</h2><p className="mt-1 text-sm text-slate-500">Built-in names can be personalized for your account.</p></div>
          <div className="min-h-0 overflow-y-auto p-5">
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (categoryName.trim()) categoryMutation.mutate({ name: categoryName }) }}>
              <input aria-label="New category name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className="h-11 min-w-0 grow rounded-xl border border-slate-200 px-3 text-sm" placeholder="New category" maxLength={80} />
              <button className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white" disabled={categoryMutation.isPending}>Add</button>
            </form>
            {mutationError ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{mutationError}</p> : null}
            <div className="mt-4 space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                  {categoryManagerMode === 'rename' && selectedCategoryId === category.id ? (
                    <form className="flex min-h-12 items-center gap-2" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeCategoryEditor() } }} onSubmit={(event) => { event.preventDefault(); const trimmedName = renameDraft.trim(); if (trimmedName && !categoryMutation.isPending) categoryMutation.mutate({ id: category.id, name: trimmedName }) }}>
                      <input autoFocus aria-label={`Rename ${category.name}`} value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} className="h-11 min-w-0 grow rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10" />
                      <button type="submit" data-press="icon" data-press-tone="blue" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:bg-slate-300" aria-label={`Save rename for ${category.name}`} title={`Save rename for ${category.name}`} disabled={!renameDraft.trim() || categoryMutation.isPending}><Check size={17} aria-hidden="true" /></button>
                      <button type="button" data-press="icon" data-press-tone="slate" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20" aria-label={`Cancel rename for ${category.name}`} title={`Cancel rename for ${category.name}`} onClick={closeCategoryEditor}><X size={17} aria-hidden="true" /></button>
                    </form>
                  ) : categoryManagerMode === 'delete' && selectedCategoryId === category.id ? (
                    <div className="py-1">
                      <p className="text-sm font-semibold">Delete {category.name}</p>
                      <select aria-label={`Replacement for ${category.name}`} value={replacementId} onChange={(event) => setReplacementId(event.target.value)} className="mt-2 min-w-0 rounded-lg border px-2 text-sm"><option value="">Choose replacement category</option>{categories.filter((item) => item.id !== category.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                      <div className="mt-2 flex gap-3"><button disabled={!replacementId || deleteMutation.isPending} className="text-xs font-bold text-red-600" onClick={() => deleteMutation.mutate({ id: category.id, replacement: replacementId })}>Delete and reassign</button><button type="button" className="text-xs" onClick={() => { setCategoryManagerMode(null); setSelectedCategoryId(null); setReplacementId('') }}>Cancel</button></div>
                    </div>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3">
                      <span className="min-w-0 grow break-words text-sm font-semibold text-slate-700">{category.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {category.isCustom ? (
                          <>
                            <button type="button" data-press="icon" data-press-tone="slate" className="grid h-11 w-11 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20" aria-label={`Rename ${category.name}`} title={`Rename ${category.name}`} onClick={() => { setCategoryManagerMode('rename'); setSelectedCategoryId(category.id); setRenameDraft(category.name); setReplacementId('') }}><Pencil size={16} aria-hidden="true" /></button>
                            <button type="button" data-press="icon" data-press-tone="red" className="grid h-11 w-11 place-items-center rounded-full text-red-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20" aria-label={`Delete ${category.name}`} title={`Delete ${category.name}`} onClick={() => { setCategoryManagerMode('delete'); setSelectedCategoryId(category.id); setReplacementId(''); setRenameDraft('') }}><Trash2 size={16} aria-hidden="true" /></button>
                          </>
                        ) : (
                          <>
                            <button type="button" data-press="icon" data-press-tone="slate" className="grid h-11 w-11 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20" aria-label={`Rename ${category.name}`} title={`Rename ${category.name}`} onClick={() => { setCategoryManagerMode('rename'); setSelectedCategoryId(category.id); setRenameDraft(category.name); setReplacementId('') }}><Pencil size={16} aria-hidden="true" /></button>
                            {category.isOverridden ? <button type="button" data-press="icon" data-press-tone="slate" className="grid h-11 w-11 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:text-slate-200" disabled={resetLabelMutation.isPending} aria-label={`Reset ${category.name} name`} title={`Reset ${category.name} name`} onClick={() => resetLabelMutation.mutate(category.id)}><RotateCcw size={16} aria-hidden="true" /></button> : null}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-100 p-4"><button className="min-h-11 w-full rounded-xl border border-slate-200 bg-white font-bold text-slate-500 transition hover:bg-slate-50" onClick={() => { setIsCategoryManagerOpen(false); setCategoryManagerMode(null); setSelectedCategoryId(null); setMutationError(''); window.requestAnimationFrame(() => categoryManagerTriggerRef.current?.focus()) }}>Done</button></div>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {mode === 'add' ? 'Add Exercise' : 'Swap Exercise'}
            </p>
             <h2 id="exercise-picker-dialog-title" className="mt-1 break-words text-xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">
              {mode === 'add' ? 'Choose an exercise' : currentExerciseName}
            </h2>
          </div>
          <div className="min-h-0 overflow-y-auto p-5">
             <input
               type="search"
               aria-label="Search exercises"
               value={search}
               disabled={pickerIsBusy}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search exercises..."
              className="h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-900"
            />
            <div role="tablist" aria-label="Exercise source" className="my-4 flex gap-1 rounded-[12px] bg-slate-100 p-1">
              <button
                type="button"
                ref={programTabRef}
                id={`${pickerId}-program-tab`}
                role="tab"
                aria-selected={source === 'program'}
                 aria-controls={`${pickerId}-panel`}
                 tabIndex={source === 'program' ? 0 : -1}
                 disabled={pickerIsBusy}
                onClick={() => selectSource('program')}
                onKeyDown={(event) => handleSourceTabKeyDown(event, 'program')}
                className={`min-h-11 flex-1 rounded-[9px] px-3 py-2 text-xs font-bold transition ${source === 'program' ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.1)]' : 'text-slate-500'}`}
              >
                Program days
              </button>
              <button
                type="button"
                ref={allExercisesTabRef}
                id={`${pickerId}-all-tab`}
                role="tab"
                aria-selected={source === 'all'}
                 aria-controls={`${pickerId}-panel`}
                 tabIndex={source === 'all' ? 0 : -1}
                 disabled={pickerIsBusy}
                onClick={() => selectSource('all')}
                onKeyDown={(event) => handleSourceTabKeyDown(event, 'all')}
                className={`min-h-11 flex-1 rounded-[9px] px-3 py-2 text-xs font-bold transition ${source === 'all' ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.1)]' : 'text-slate-500'}`}
              >
                All exercises
              </button>
            </div>

             <div
               id={`${pickerId}-panel`}
               role="tabpanel"
               aria-busy={pickerIsBusy || undefined}
              aria-labelledby={source === 'program' ? `${pickerId}-program-tab` : `${pickerId}-all-tab`}
            >
              {isSourcePending ? (
                <p role="status" aria-live="polite" className="rounded-[12px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                  Loading exercises...
                </p>
              ) : null}
              {isSourceError ? (
                <p role="alert" className="rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  Unable to load exercises. Please try again.
                </p>
              ) : null}
              {source === 'all' && categoriesQuery.isPending ? <p role="status" className="rounded-[12px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">Loading categories...</p> : null}
              {source === 'all' && categoriesQuery.isError ? <div className="rounded-[12px] bg-red-50 px-4 py-3 text-sm text-red-700"><p>Unable to load categories.</p><button className="mt-2 font-bold underline" onClick={() => void categoriesQuery.refetch()}>Retry</button></div> : null}
               {!isSourcePending && !isSourceError && (source === 'program' || (!categoriesQuery.isPending && !categoriesQuery.isError)) && visibleGroups.length === 0 ? (
                 <p role="status" aria-live="polite" className="rounded-[12px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                   {!hasSourceExercises
                     ? source === 'program' ? 'Your Program has no exercises yet.' : 'No exercises are available.'
                     : 'No exercises match your search.'}
                 </p>
               ) : null}

              <div className="space-y-4">
                {visibleGroups.map((group) => (
                  <section key={group.id}>
                     <p className="mb-2 break-words text-xs font-bold uppercase tracking-[0.14em] text-slate-400 [overflow-wrap:anywhere]">{group.label}</p>
                    <div className="space-y-2">
                      {group.exercises.map((exercise) => {
                        const isCurrent = currentExerciseId === exercise.id
                        const isAdded = existingIds.has(exercise.id) && !isCurrent
                        const isSelected = selectedExerciseId === exercise.id
                        const isDisabled = isAdded

                        return (
                          <span key={`${group.id}-${exercise.id}`} className="block">
                          <button
                            key={`${group.id}-${exercise.id}`}
                            type="button"
                            onClick={() => onSelectedExercise(exercise.id)}
                           disabled={isDisabled || isSaving}
                            aria-pressed={isSelected}
                            className={`flex min-h-11 w-full items-center gap-3 rounded-[14px] border px-4 py-3 text-left text-sm font-semibold transition ${
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
                             <span className="min-w-0 grow break-words [overflow-wrap:anywhere]">{exercise.name}</span>
                             {exercise.isCustom ? <span className={`shrink-0 text-xs ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>Yours</span> : null}
                             {isCurrent ? <span className={`shrink-0 text-xs ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>Current</span> : null}
                             {isAdded ? <span className="shrink-0 text-xs text-slate-400">Added</span> : null}
                          </button>
                          {exercise.isCustom && source === 'all' ? <button type="button" className="mt-1 text-xs font-bold underline" onClick={() => setEditingExerciseId(editingExerciseId === exercise.id ? null : exercise.id)}>Edit category</button> : null}
                          {editingExerciseId === exercise.id ? <div className="mt-1 flex gap-2"><label htmlFor={`${pickerId}-${exercise.id}-category`} className="sr-only">Category for {exercise.name}</label><select id={`${pickerId}-${exercise.id}-category`} disabled={recategorizeMutation.isPending} value={exercise.category.id} onChange={(event) => recategorizeMutation.mutate({ exerciseId: exercise.id, categoryId: event.target.value })} className="min-h-10 min-w-0 grow rounded-lg border px-2 text-sm">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div> : null}</span>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {saveError ? (
                <p role="alert" className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveError}
                </p>
              ) : null}
            </div>
            <button type="button" ref={categoryManagerTriggerRef} className="mt-4 min-h-11 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300" onClick={() => { setIsCategoryManagerOpen(true); setMutationError('') }} disabled={pickerIsBusy || categoriesQuery.isPending || categoriesQuery.isError}>Manage categories</button>
            <button
              type="button"
              ref={newExerciseTriggerRef}
               onClick={() => {
                 if (isSaving || createMutation.isPending) return
                createMutation.reset()
                setIsNewExerciseOpen(true)
              }}
              disabled={pickerIsBusy || categoriesQuery.isPending || categoriesQuery.isError || categories.length === 0}
              className="mt-5 min-h-11 w-full rounded-[14px] border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              + New Exercise
            </button>
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={onClose}
               disabled={pickerIsBusy}
              className="min-h-11 flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
               disabled={!selectedExerciseId || pickerIsBusy || selectedExerciseId === currentExerciseId}
              className="min-h-11 flex-1 rounded-[14px] bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isSaving ? 'Saving...' : mode === 'add' ? 'Add Exercise' : 'Swap'}
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
