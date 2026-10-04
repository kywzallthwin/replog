import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExercisePickerDialog } from '../components/exercises/ExercisePickerDialog'
import { exercisesQueryKey, mergeExercise } from '../lib/exercises'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/exercises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/exercises')>()),
  mergeExercise: vi.fn(),
}))

const mockedMergeExercise = vi.mocked(mergeExercise)

const category = { id: 'category-back', name: 'Back', isCustom: false }
const source = { id: 'source', name: 'Vague Pull', category, isCustom: true }
const builtInSource = { id: 'built-in-source', name: 'Built-in Pull', category, isCustom: false }
const keeper = { id: 'keeper', name: 'Chest Supported Row', category, isCustom: true }
const otherKeeper = { id: 'other-keeper', name: 'One Arm Row', category, isCustom: true }

function renderPicker(options = [source, keeper, otherKeeper]) {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['exercise-categories'], [category])
  queryClient.setQueryData(exercisesQueryKey, options)

  render(
    <QueryClientProvider client={queryClient}>
      <ExercisePickerDialog
        mode="add"
        exerciseOptions={options}
        program={null}
        existingExerciseIds={[]}
        selectedExerciseId=""
        isOptionsPending={false}
        isOptionsError={false}
        isSaving={false}
        onSelectedExercise={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    </QueryClientProvider>,
  )

  fireEvent.click(screen.getByRole('tab', { name: 'All exercises' }))
  return queryClient
}

describe('exercise merge picker flow', () => {
  it('focuses the keeper search, supports keyboard traversal, and preserves confirmation after filtering', async () => {
    renderPicker()

    const mergeButton = screen.getByRole('button', { name: 'Merge Vague Pull' })
    mergeButton.focus()
    fireEvent.click(mergeButton)

    const search = screen.getByRole('searchbox', { name: 'Search keeper exercises' })
    expect(search).toHaveFocus()
    const dialog = screen.getByRole('dialog', { name: 'Merge Vague Pull' })
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(screen.getByRole('button', { name: /Chest Supported Row/ })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
    fireEvent.change(search, { target: { value: 'One Arm' } })

    expect(screen.getByText('Merge Vague Pull')).toBeInTheDocument()
    expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm merge' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Merge Vague Pull' })).toHaveFocus())
  })

  it('removes a merged source from the cached library and restores focus to All exercises', async () => {
    mockedMergeExercise.mockResolvedValueOnce({ changedProgramDayEntries: 1, changedWorkoutEntries: 1 })
    const queryClient = renderPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Merge Vague Pull' }))
    fireEvent.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }))

    await waitFor(() => expect(mockedMergeExercise).toHaveBeenCalledWith('source', 'keeper'))
    await waitFor(() => expect(queryClient.getQueryData(exercisesQueryKey)).toEqual([keeper, otherKeeper]))
    expect(screen.getByRole('tab', { name: 'All exercises' })).toHaveFocus()
    expect(screen.queryByRole('dialog', { name: 'Merge Vague Pull' })).not.toBeInTheDocument()
  })

  it('keeps a merged built-in source in the cached library and visible in All exercises', async () => {
    mockedMergeExercise.mockResolvedValueOnce({ changedProgramDayEntries: 1, changedWorkoutEntries: 1 })
    const queryClient = renderPicker([builtInSource, keeper, otherKeeper])

    fireEvent.click(screen.getByRole('button', { name: 'Merge Built-in Pull' }))
    fireEvent.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }))

    await waitFor(() => expect(mockedMergeExercise).toHaveBeenCalledWith('built-in-source', 'keeper'))
    await waitFor(() => expect(queryClient.getQueryData(exercisesQueryKey)).toEqual([builtInSource, keeper, otherKeeper]))
    expect(screen.getByRole('button', { name: 'Merge Built-in Pull' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All exercises' })).toHaveFocus()
  })
})
