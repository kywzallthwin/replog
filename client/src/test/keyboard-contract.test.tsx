import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProgramActionsMenu } from '../components/programs/ProgramActionsMenu'
import { ProgramDeleteDialog } from '../components/programs/ProgramDeleteDialog'
import { failForKnownBaselineDefect } from './expected-failure'

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

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it.fails('moves focus into a dialog when it opens from a trigger', () => {
    return failForKnownBaselineDefect(() => {
      render(<DeleteDialogHarness />)

      const trigger = screen.queryByRole('button', { name: 'Open delete dialog' })
      if (!trigger) {
        return
      }

      trigger.focus()
      fireEvent.click(trigger)

      const dialog = screen.queryByRole('alertdialog', { name: 'Delete Strength Base?' })
      if (!dialog) {
        return
      }

      return dialog.contains(document.activeElement)
    }, 'dialog opening does not move focus inside the active dialog')
  })
})
