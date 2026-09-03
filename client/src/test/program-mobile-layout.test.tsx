import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExercisePickerDialog } from '../components/exercises/ExercisePickerDialog'
import { ProgramDeleteDialog } from '../components/programs/ProgramDeleteDialog'
import { getCopiedProgramName } from '../lib/programs'
import { createTestQueryClient } from './query-client'

const longName = 'UnbrokenExerciseNameThatMustRemainVisibleAtMobileWidths0123456789'

describe('program mobile layout contract', () => {
  it('keeps copied program names within the 80-character API limit', () => {
    const copiedName = getCopiedProgramName('A'.repeat(80))

    expect(copiedName).toHaveLength(80)
    expect(copiedName.endsWith(' Copy')).toBe(true)
  })

  it('wraps long picker names instead of clipping them', () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <ExercisePickerDialog
          mode="add"
          exerciseOptions={[]}
          program={{
            id: 'program-1',
            name: 'Program',
            isActive: true,
            days: [{
              id: 'day-1',
              name: 'Day',
              badgeColor: 'bg-blue-100 text-blue-800',
              order: 1,
              exercises: [{
                id: 'day-exercise-1',
                exerciseId: 'exercise-1',
                name: longName,
                category: 'BACK',
                order: 1,
              }],
            }],
          }}
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

    expect(screen.getByText(longName)).toHaveClass('min-w-0', 'break-words')
  })

  it('bounds program deletion content for constrained mobile heights', () => {
    render(
      <ProgramDeleteDialog
        program={{ id: 'program-1', name: longName, isActive: false, dayCount: 10, exerciseCount: 40 }}
        isDeleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveClass('max-h-[calc(100dvh-3rem)]', 'overflow-y-auto')
    expect(screen.getByRole('heading', { name: `Delete ${longName}?` })).toHaveClass('break-words')
  })
})
