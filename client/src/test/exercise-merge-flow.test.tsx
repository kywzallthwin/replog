import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExercisePickerDialog } from '../components/exercises/ExercisePickerDialog'
import { exercisesQueryKey, mergeExercise } from '../lib/exercises'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/exercises', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/exercises')>()), mergeExercise: vi.fn() }))
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
  render(<QueryClientProvider client={queryClient}><ExercisePickerDialog mode="add" exerciseOptions={options} program={null} existingExerciseIds={[]} selectedExerciseId="" isOptionsPending={false} isOptionsError={false} isSaving={false} onSelectedExercise={vi.fn()} onConfirm={vi.fn()} onClose={vi.fn()} onCreated={vi.fn()} /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('tab', { name: 'All exercises' }))
  return queryClient
}

function openKeeperSelection() {
  fireEvent.click(screen.getByRole('button', { name: 'Merge exercises' }))
  const search = screen.getByRole('searchbox', { name: 'Search exercises' })
  expect(search).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Vague Pull' }))
}

describe('exercise merge picker flow', () => {
  it('keeps the All exercises list visible, supports back, and restores focus on cancel', async () => {
    renderPicker()
    openKeeperSelection()
    expect(screen.getByRole('searchbox', { name: 'Search exercises' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search exercises' })).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Vague Pull' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel merge' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Merge exercises' })).toHaveFocus())
  })

  it('selects a keeper from the visible list and enables confirmation', () => {
    renderPicker()
    openKeeperSelection()
    const keeperButton = screen.getByRole('button', { name: /Chest Supported Row/ })
    fireEvent.click(keeperButton)
    expect(keeperButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Confirm merge' })).toBeEnabled()
  })

  it('keeps merge errors in the keeper view', async () => {
    mockedMergeExercise.mockRejectedValueOnce(new Error('The workout is still active.'))
    renderPicker()
    openKeeperSelection()
    fireEvent.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to merge exercises. Please try again.'))
    expect(screen.getByRole('button', { name: 'Confirm merge' })).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === 'Merge Vague Pull into Chest Supported Row?')).toBeInTheDocument()
  })

  it('removes a merged custom source and restores focus to All exercises', async () => {
    mockedMergeExercise.mockResolvedValueOnce({ changedProgramDayEntries: 1, changedWorkoutEntries: 1 })
    const queryClient = renderPicker()
    openKeeperSelection()
    fireEvent.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }))
    await waitFor(() => expect(mockedMergeExercise).toHaveBeenCalledWith('source', 'keeper'))
    await waitFor(() => expect(queryClient.getQueryData(exercisesQueryKey)).toEqual([keeper, otherKeeper]))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'All exercises' })).toHaveFocus())
  })

  it('keeps a merged built-in source visible in All exercises', async () => {
    mockedMergeExercise.mockResolvedValueOnce({ changedProgramDayEntries: 1, changedWorkoutEntries: 1 })
    const queryClient = renderPicker([builtInSource, keeper, otherKeeper])
    fireEvent.click(screen.getByRole('button', { name: 'Merge exercises' }))
    fireEvent.click(screen.getByRole('button', { name: 'Built-in Pull' }))
    fireEvent.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }))
    await waitFor(() => expect(mockedMergeExercise).toHaveBeenCalledWith('built-in-source', 'keeper'))
    await waitFor(() => expect(queryClient.getQueryData(exercisesQueryKey)).toEqual([builtInSource, keeper, otherKeeper]))
    expect(screen.getByRole('button', { name: 'Built-in Pull' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('tab', { name: 'All exercises' })).toHaveFocus())
  })

  it('removes row merge controls while keeping category editing available', () => {
    renderPicker()
    expect(screen.queryByRole('button', { name: 'Merge Vague Pull' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit category for Vague Pull' })).toBeInTheDocument()
  })
})
