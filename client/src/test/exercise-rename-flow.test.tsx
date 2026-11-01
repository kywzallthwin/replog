import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExercisePickerDialog } from '../components/exercises/ExercisePickerDialog'
import { deleteExercise, exercisesQueryKey, getCategories, updateExercise, type CategorySummary, type ExerciseOption } from '../lib/exercises'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/exercises', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/exercises')>()), deleteExercise: vi.fn(), getCategories: vi.fn(), updateExercise: vi.fn() }))
const mockedDeleteExercise = vi.mocked(deleteExercise)
const mockedGetCategories = vi.mocked(getCategories)
const mockedUpdateExercise = vi.mocked(updateExercise)

const chest: CategorySummary = { id: 'category-chest', name: 'Chest', isCustom: false }
const back: CategorySummary = { id: 'category-back', name: 'Back', isCustom: false }
const custom: ExerciseOption = { id: 'custom', name: 'Chest flat bench press', category: chest, isCustom: true }
const builtIn: ExerciseOption = { id: 'built-in', name: 'Bench Press', category: chest, isCustom: false }

function axiosError(message: string) {
  return { isAxiosError: true, response: { data: { error: message } } }
}

beforeEach(() => {
  mockedDeleteExercise.mockReset()
  mockedGetCategories.mockReset()
  mockedGetCategories.mockResolvedValue([chest, back])
  mockedUpdateExercise.mockReset()
})

function renderPicker(
  options: ExerciseOption[] = [custom, builtIn],
  overrides: { selectedExerciseId?: string; onSelectedExercise?: (exerciseId: string) => void } = {},
) {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['exercise-categories'], [chest, back])
  queryClient.setQueryData(exercisesQueryKey, options)
  render(
    <QueryClientProvider client={queryClient}>
      <ExercisePickerDialog
        mode="add"
        exerciseOptions={options}
        program={null}
        existingExerciseIds={[]}
        selectedExerciseId={overrides.selectedExerciseId ?? ''}
        isOptionsPending={false}
        isOptionsError={false}
        isSaving={false}
        onSelectedExercise={overrides.onSelectedExercise ?? vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('tab', { name: 'All exercises' }))
  return queryClient
}

function openEditor(name = 'Chest flat bench press') {
  fireEvent.click(screen.getByRole('button', { name: `Edit exercise ${name}` }))
  return screen.getByRole('group', { name: `Exercise editor for ${name}` })
}

function nameInput() {
  return screen.getByRole('textbox', { name: 'Name' })
}

describe('exercise rename picker flow', () => {
  it('opens the editor with the current name pre-filled and focused', async () => {
    renderPicker()
    openEditor()
    expect(nameInput()).toHaveValue('Chest flat bench press')
    await waitFor(() => expect(nameInput()).toHaveFocus())
  })

  it('renames a custom exercise and returns focus to the pencil', async () => {
    mockedUpdateExercise.mockResolvedValueOnce({ ...custom, name: 'Flat Bench Press' })
    const queryClient = renderPicker()
    openEditor()
    fireEvent.change(nameInput(), { target: { value: 'Flat Bench Press' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockedUpdateExercise).toHaveBeenCalledWith('custom', { name: 'Flat Bench Press' }))
    await waitFor(() => expect(queryClient.getQueryData(exercisesQueryKey)).toEqual([{ ...custom, name: 'Flat Bench Press' }, builtIn]))
    expect(screen.queryByRole('group', { name: 'Exercise editor for Chest flat bench press' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit exercise Chest flat bench press' })).toHaveFocus())
  })

  it('sends only the changed fields', async () => {
    mockedUpdateExercise.mockResolvedValueOnce(custom)
    renderPicker()
    const editor = openEditor()
    fireEvent.click(within(editor).getByRole('button', { name: 'Category for Chest flat bench press: Chest' }))
    fireEvent.click(screen.getByRole('option', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockedUpdateExercise).toHaveBeenCalledWith('custom', { categoryId: 'category-back' }))
  })

  it('sends the name and the category together when both change', async () => {
    mockedUpdateExercise.mockResolvedValueOnce(custom)
    renderPicker()
    const editor = openEditor()
    fireEvent.change(nameInput(), { target: { value: 'Flat Bench Press' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Category for Chest flat bench press: Chest' }))
    fireEvent.click(screen.getByRole('option', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockedUpdateExercise).toHaveBeenCalledWith('custom', { name: 'Flat Bench Press', categoryId: 'category-back' }))
  })

  it('keeps save disabled when the name is empty or nothing changed', () => {
    renderPicker()
    openEditor()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.change(nameInput(), { target: { value: '   ' } })
    expect(save).toBeDisabled()
    fireEvent.change(nameInput(), { target: { value: 'Chest flat bench press' } })
    expect(save).toBeDisabled()
    fireEvent.change(nameInput(), { target: { value: 'Flat Bench Press' } })
    expect(save).toBeEnabled()
  })

  it('keeps a duplicate name error in the editor without discarding the typed name', async () => {
    mockedUpdateExercise.mockRejectedValueOnce(axiosError('An exercise with this name already exists'))
    renderPicker()
    openEditor()
    fireEvent.change(nameInput(), { target: { value: 'Bench Press' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('An exercise with this name already exists'))
    expect(nameInput()).toHaveValue('Bench Press')
    expect(screen.getByRole('group', { name: 'Exercise editor for Chest flat bench press' })).toBeInTheDocument()
  })

  it('falls back to a generic message when the failure is not a server error', async () => {
    mockedUpdateExercise.mockRejectedValueOnce(new Error('network down'))
    renderPicker()
    openEditor()
    fireEvent.change(nameInput(), { target: { value: 'Flat Bench Press' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to save exercise.'))
  })

  it('keeps the editor pending while the request is in flight', async () => {
    mockedUpdateExercise.mockReturnValueOnce(new Promise(() => {}))
    renderPicker()
    const editor = openEditor()
    fireEvent.change(nameInput(), { target: { value: 'Flat Bench Press' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled())
    expect(within(editor).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(nameInput()).toBeDisabled()
  })

  it('cancels with escape without closing the picker and restores focus to the pencil', async () => {
    renderPicker()
    openEditor()
    fireEvent.change(nameInput(), { target: { value: 'Flat Bench Press' } })
    fireEvent.keyDown(nameInput(), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Exercise editor for Chest flat bench press' })).not.toBeInTheDocument())
    expect(screen.getByRole('searchbox', { name: 'Search exercises' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit exercise Chest flat bench press' })).toHaveFocus())
  })

  it('cancels with the cancel button and restores focus to the pencil', async () => {
    renderPicker()
    const editor = openEditor()
    fireEvent.change(nameInput(), { target: { value: 'Flat Bench Press' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Exercise editor for Chest flat bench press' })).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit exercise Chest flat bench press' })).toHaveFocus())
  })

  it('does not expose a rename action for built-in exercises', () => {
    renderPicker([builtIn])
    expect(screen.queryByRole('button', { name: 'Edit exercise Bench Press' })).not.toBeInTheDocument()
  })

  it('opens the delete confirmation dialog and restores focus to Delete exercise on cancel or Escape', async () => {
    renderPicker()
    const editor = openEditor()
    const deleteTrigger = within(editor).getByRole('button', { name: 'Delete exercise' })
    fireEvent.click(deleteTrigger)

    const alertDialog = screen.getByRole('alertdialog', { name: 'Delete Chest flat bench press?' })
    expect(alertDialog).toHaveTextContent('Completed workout history and progress will remain preserved.')

    fireEvent.click(within(alertDialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('group', { name: 'Exercise editor for Chest flat bench press' })).toBeInTheDocument()
    await waitFor(() => expect(deleteTrigger).toHaveFocus())

    fireEvent.click(deleteTrigger)
    const reopenedDialog = screen.getByRole('alertdialog', { name: 'Delete Chest flat bench press?' })
    fireEvent.keyDown(reopenedDialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('group', { name: 'Exercise editor for Chest flat bench press' })).toBeInTheDocument()
    await waitFor(() => expect(deleteTrigger).toHaveFocus())
  })

  it('deletes a custom exercise, removes it from the picker, clears selection, and restores focus to search', async () => {
    mockedDeleteExercise.mockResolvedValueOnce(undefined)
    const onSelectedExercise = vi.fn()
    const queryClient = renderPicker([custom, builtIn], {
      selectedExerciseId: 'custom',
      onSelectedExercise,
    })

    const editor = openEditor()
    fireEvent.click(within(editor).getByRole('button', { name: 'Delete exercise' }))
    const alertDialog = screen.getByRole('alertdialog', { name: 'Delete Chest flat bench press?' })
    fireEvent.click(within(alertDialog).getByRole('button', { name: 'Delete exercise' }))

    await waitFor(() => expect(mockedDeleteExercise).toHaveBeenCalledWith('custom'))
    await waitFor(() => expect(queryClient.getQueryData(exercisesQueryKey)).toEqual([builtIn]))
    expect(onSelectedExercise).toHaveBeenCalledWith('')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Exercise editor for Chest flat bench press' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chest flat bench press' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search exercises' })).toHaveFocus())
  })

  it('shows pending and error states inside the delete confirmation dialog', async () => {
    let rejectDelete: (reason?: unknown) => void = () => {}
    mockedDeleteExercise.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        rejectDelete = reject
      }),
    )

    renderPicker()
    const editor = openEditor()
    fireEvent.click(within(editor).getByRole('button', { name: 'Delete exercise' }))
    const alertDialog = screen.getByRole('alertdialog', { name: 'Delete Chest flat bench press?' })
    fireEvent.click(within(alertDialog).getByRole('button', { name: 'Delete exercise' }))

    await waitFor(() => expect(within(alertDialog).getByRole('button', { name: 'Deleting…' })).toBeDisabled())
    expect(within(alertDialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()

    rejectDelete(axiosError('Exercise not found'))
    await waitFor(() => expect(within(alertDialog).getByRole('alert')).toHaveTextContent('Exercise not found'))
    expect(screen.getByRole('alertdialog', { name: 'Delete Chest flat bench press?' })).toBeInTheDocument()
  })
})
