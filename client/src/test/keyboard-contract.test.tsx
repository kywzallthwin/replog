import { useRef, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExercisePickerDialog } from '../components/exercises/ExercisePickerDialog'
import { FluidSelect } from '../components/forms/FluidSelect'
import { ProgramActionsMenu } from '../components/programs/ProgramActionsMenu'
import { ProgramDeleteDialog } from '../components/programs/ProgramDeleteDialog'
import { Dialog } from '../components/ui/Dialog'
import { createTestQueryClient } from './query-client'

const deleteTarget = {
  id: 'program-1',
  name: 'Strength Base',
  isActive: false,
  dayCount: 3,
  exerciseCount: 9,
}

function DeleteDialogHarness() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open delete dialog
      </button>
      {isOpen ? (
        <ProgramDeleteDialog
          program={deleteTarget}
          isDeleting={false}
          onCancel={() => setIsOpen(false)}
          onConfirm={vi.fn()}
        />
      ) : null}
    </>
  )
}

function LockedDialogHarness() {
  const [isOpen, setIsOpen] = useState(true)

  return isOpen ? (
    <Dialog labelledBy="locked-dialog-title" onClose={() => setIsOpen(false)}>
      <h2 id="locked-dialog-title">Locked dialog</h2>
      <button type="button" onClick={() => setIsOpen(false)}>Close</button>
    </Dialog>
  ) : null
}

function DeletingTriggerDialogHarness() {
  const [isOpen, setIsOpen] = useState(false)
  const [showTrigger, setShowTrigger] = useState(true)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const fallbackRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      {showTrigger ? (
        <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)}>
          Open removable dialog
        </button>
      ) : null}
      <button ref={fallbackRef} type="button">Stable fallback</button>
      {isOpen ? (
        <Dialog
          labelledBy="deleting-dialog-title"
          restoreFocusRef={triggerRef}
          fallbackFocusRef={fallbackRef}
          onClose={() => setIsOpen(false)}
        >
          <h2 id="deleting-dialog-title">Deleting dialog</h2>
          <button type="button" onClick={() => { setShowTrigger(false); setIsOpen(false) }}>
            Delete trigger
          </button>
        </Dialog>
      ) : null}
    </>
  )
}

describe('dialog and menu keyboard contract', () => {
  it('exposes an alert dialog and dismisses it with Escape', () => {
    const onCancel = vi.fn()

    render(
      <ProgramDeleteDialog
        program={deleteTarget}
        isDeleting={false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('alertdialog', { name: 'Delete Strength Base?' })

    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'delete-program-dialog-title')
    expect(dialog).toHaveAttribute('aria-describedby', 'delete-program-dialog-description')

    if (!dialog.parentElement) {
      throw new Error('Dialog overlay was not rendered')
    }

    fireEvent.keyDown(dialog.parentElement, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('exposes menu items and dismisses an open actions menu with Escape', async () => {
    const onToggle = vi.fn()

    render(
      <ProgramActionsMenu
        programName="Strength Base"
        isOpen
        onToggle={onToggle}
        onCopy={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const menu = await screen.findByRole('menu', { name: 'Strength Base actions' })

    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    expect(menu).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('moves focus into a dialog, contains Tab, and restores the trigger', () => {
    render(<DeleteDialogHarness />)

    const trigger = screen.getByRole('button', { name: 'Open delete dialog' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('alertdialog', { name: 'Delete Strength Base?' })
    const buttons = within(dialog).getAllByRole('button')

    expect(buttons[0]).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(buttons[1]).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(buttons[0]).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(trigger).toHaveFocus()
  })

  it('locks body scrolling and restores body styles when it closes', () => {
    render(<LockedDialogHarness />)

    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(document.body.style.position).toBe('')
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps an open nested select Escape from closing its parent dialog', () => {
    const onClose = vi.fn()

    render(
      <Dialog labelledBy="select-dialog-title" onClose={onClose}>
        <h2 id="select-dialog-title">Select dialog</h2>
        <FluidSelect
          value="first"
          options={[{ value: 'first', label: 'First' }, { value: 'second', label: 'Second' }]}
          onValueChange={vi.fn()}
          ariaLabel="Copy from"
        />
      </Dialog>,
    )

    const select = screen.getByRole('button', { name: 'Copy from: First' })
    fireEvent.click(select)
    expect(screen.getByRole('listbox', { name: 'Copy from' })).toBeInTheDocument()

    fireEvent.keyDown(select, { key: 'Escape' })

    expect(screen.queryByRole('listbox', { name: 'Copy from' })).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps a disabled-only menu action focusable and non-activating', async () => {
    const onDelete = vi.fn()

    render(
      <ProgramActionsMenu
        programName="Active Program"
        isOpen
        onToggle={vi.fn()}
        onDelete={onDelete}
        deleteDisabled
      />,
    )

    const deleteItem = await screen.findByRole('menuitem', { name: 'Delete' })
    expect(deleteItem).toHaveFocus()
    expect(deleteItem).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(deleteItem)

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('uses fallback focus when the original destructive trigger is removed', () => {
    render(<DeletingTriggerDialogHarness />)

    const trigger = screen.getByRole('button', { name: 'Open removable dialog' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Delete trigger' }))

    expect(screen.getByRole('button', { name: 'Stable fallback' })).toHaveFocus()
  })

  it('gives the custom exercise form the active picker dialog contract', () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <ExercisePickerDialog
          mode="add"
          exerciseOptions={[]}
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

    fireEvent.click(screen.getByRole('button', { name: '+ New Exercise' }))

    const dialog = screen.getByRole('dialog', { name: 'New Exercise' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'new-exercise-dialog-title')
    expect(dialog).toHaveAttribute('aria-describedby', 'new-exercise-dialog-description')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.getByRole('dialog', { name: 'Choose an exercise' })).toBeInTheDocument()
  })
})
