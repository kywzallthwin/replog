import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgramPage } from '../pages/ProgramPage'
import type { ProgramDay } from '../lib/programs'
import { createTestQueryClient } from './query-client'

const apiMocks = vi.hoisted(() => ({
  currentProgram: null as import('../lib/programs').Program | null,
  getProgram: vi.fn(),
  addDay: vi.fn(),
  updateDay: vi.fn(),
  reorderDay: vi.fn(),
  activateProgram: vi.fn(),
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
  deleteProgram: vi.fn(),
  dashboard: { activeSession: null as unknown },
  getDashboard: vi.fn(),
}))

vi.mock('../lib/programs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/programs')>()

  return {
    ...actual,
    getProgram: apiMocks.getProgram,
    addDay: apiMocks.addDay,
    updateDay: apiMocks.updateDay,
    reorderDay: apiMocks.reorderDay,
    activateProgram: apiMocks.activateProgram,
    createProgram: apiMocks.createProgram,
    updateProgram: apiMocks.updateProgram,
    deleteProgram: apiMocks.deleteProgram,
  }
})

vi.mock('../lib/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dashboard')>()

  return { ...actual, getDashboard: apiMocks.getDashboard }
})

function ProgramsFocusTarget() {
  const location = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (location.state?.focus === 'programs-heading') headingRef.current?.focus()
  }, [location.state])

  return <h1 ref={headingRef} tabIndex={-1}>Programs</h1>
}

function renderEditor() {
  const queryClient = createTestQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/program/program-1']}>
        <Routes>
          <Route path="/program/:programId" element={<ProgramPage />} />
          <Route path="/program" element={<ProgramsFocusTarget />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function makeProgram({ name = 'Upper / Lower', isActive = false } = {}) {
  return {
    id: 'program-1',
    name,
    isActive,
    days: [{
      id: 'day-1',
      name: 'Upper',
      badgeColor: 'bg-blue-100 text-blue-800',
      order: 1,
      exercises: [{
        id: 'day-exercise-1',
        exerciseId: 'exercise-1',
        name: 'Bench Press',
        category: { id: 'category-1', name: 'Chest', isCustom: false },
        order: 1,
      }],
    }],
  }
}

async function openActions() {
  fireEvent.click(await screen.findByRole('button', { name: 'More actions for Upper / Lower' }))
}

describe('program editor page actions', () => {
  beforeEach(() => {
    apiMocks.currentProgram = makeProgram()
    apiMocks.dashboard = { activeSession: null }
    apiMocks.getProgram.mockImplementation(async () => apiMocks.currentProgram)
    apiMocks.getDashboard.mockImplementation(async () => apiMocks.dashboard)
    apiMocks.addDay.mockImplementation(async ({ name }: { name: string }) => ({
      id: 'day-2', name, badgeColor: 'bg-blue-100 text-blue-800', order: 2, exercises: [],
    }))
    apiMocks.updateDay.mockImplementation(async ({ dayId, name, badgeColor }: { dayId: string; name: string; badgeColor: string }) => {
      if (!apiMocks.currentProgram) throw new Error('Missing test program')
      apiMocks.currentProgram = {
        ...apiMocks.currentProgram,
        days: apiMocks.currentProgram.days.map((day) => day.id === dayId ? { ...day, name, badgeColor } : day),
      }
      return apiMocks.currentProgram.days.find((day) => day.id === dayId)
    })
    apiMocks.activateProgram.mockImplementation(async () => {
      if (apiMocks.currentProgram) apiMocks.currentProgram = { ...apiMocks.currentProgram, isActive: true }
    })
    apiMocks.createProgram.mockImplementation(async ({ name }: { name: string }) => {
      apiMocks.currentProgram = { ...makeProgram({ name }), id: 'program-copy' }
      return apiMocks.currentProgram
    })
    apiMocks.updateProgram.mockImplementation(async (_id: string, name: string) => {
      if (!apiMocks.currentProgram) throw new Error('Missing test program')
      apiMocks.currentProgram = { ...apiMocks.currentProgram, name }
      return apiMocks.currentProgram
    })
    apiMocks.deleteProgram.mockResolvedValue(undefined)
    apiMocks.reorderDay.mockImplementation(async () => apiMocks.currentProgram?.days ?? [])
  })

  it('uses the program name as the page heading and returns focus to Back to Programs', async () => {
    renderEditor()

    expect(await screen.findByRole('heading', { level: 1, name: 'Upper / Lower' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Program' }).every((link) => link.getAttribute('aria-current') === 'page')).toBe(true)
    const programsLink = screen.getByRole('link', { name: 'Back to Programs' })
    expect(programsLink).toHaveAttribute('href', '/program')
    const navRow = programsLink.parentElement
    const menuTrigger = screen.getByRole('button', { name: 'More actions for Upper / Lower' })
    expect(navRow?.children[0]).toBe(programsLink)
    expect(navRow?.children[1]).toBe(menuTrigger)
    fireEvent.click(programsLink)
    expect(await screen.findByRole('heading', { name: 'Programs' })).toHaveFocus()
  })

  it('lets long unbroken program names wrap without clipping', async () => {
    apiMocks.currentProgram = makeProgram({ name: 'UpperLower'.repeat(16) })
    renderEditor()

    const name = await screen.findByRole('heading', { level: 1, name: 'UpperLower'.repeat(16) })
    expect(name).toHaveClass('[overflow-wrap:anywhere]')
    expect(name).not.toHaveStyle({ overflow: 'hidden' })
  })

  it('shows active state and omits the action-row activation button for the active program', async () => {
    apiMocks.currentProgram = makeProgram({ isActive: true })
    renderEditor()

    expect(await screen.findByText('Active')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make active' })).not.toBeInTheDocument()
    const actionRow = screen.getByRole('button', { name: '+ Add Day' }).parentElement
    expect(actionRow?.children).toHaveLength(1)
    await openActions()
    expect(screen.queryByRole('menuitem', { name: 'Set as active' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Rename program' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Duplicate program' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete program' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('opens Add Day from a compact action button', async () => {
    renderEditor()

    const activate = await screen.findByRole('button', { name: 'Make active' })
    const addDay = await screen.findByRole('button', { name: '+ Add Day' })
    expect(addDay).toHaveClass('shrink-0', 'text-left', 'min-h-11')
    const actionRow = addDay.parentElement
    expect(actionRow).toHaveClass('flex', 'flex-wrap')
    expect(actionRow?.children[0]).toBe(addDay)
    expect(actionRow?.children[1]).toBe(activate)
    expect(actionRow?.children).toHaveLength(2)
    const navRow = screen.getByRole('link', { name: 'Back to Programs' }).parentElement
    expect(navRow?.children[1]).toBe(screen.getByRole('button', { name: 'More actions for Upper / Lower' }))
    expect(activate).toHaveClass('shrink-0', 'min-h-11')
    fireEvent.click(addDay)
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Lower' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiMocks.addDay.mock.calls[0]?.[0]).toEqual({
      programId: 'program-1', name: 'Lower', badgeColor: 'bg-amber-100 text-amber-800',
    }))
  })

  it('keeps day editing available from the existing editor cards', async () => {
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Upper' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Upper Body' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiMocks.updateDay.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      programId: 'program-1', dayId: 'day-1', name: 'Upper Body',
    })))
    expect(await screen.findByText('Upper Body')).toBeInTheDocument()
  })

  it('renames the program in place through the options menu', async () => {
    renderEditor()
    await openActions()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename program' }))
    const input = await screen.findByLabelText('Program name')
    fireEvent.change(input, { target: { value: 'New routine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))

    await waitFor(() => expect(apiMocks.updateProgram).toHaveBeenCalledWith('program-1', 'New routine'))
    expect(await screen.findByRole('heading', { name: 'New routine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More actions for New routine' })).toHaveFocus()
  })

  it('confirms a duplicate name and navigates to the new program editor', async () => {
    renderEditor()
    await openActions()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate program' }))
    const name = await screen.findByLabelText('Program name')
    expect(name).toHaveValue('Upper / Lower Copy')
    fireEvent.click(screen.getByRole('button', { name: 'Create copy' }))

    await waitFor(() => expect(apiMocks.createProgram).toHaveBeenCalledWith({
      name: 'Upper / Lower Copy', source: 'copy', sourceProgramId: 'program-1',
    }))
    await waitFor(() => expect(apiMocks.getProgram).toHaveBeenCalledWith('program-copy'))
  })

  it('activates an inactive program through the existing safeguard', async () => {
    renderEditor()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
    await openActions()
    expect(screen.queryByRole('menuitem', { name: 'Set as active' })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Make active' }))
    await waitFor(() => expect(apiMocks.activateProgram).toHaveBeenCalledWith('program-1'))
    expect(await screen.findByText('Active')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make active' })).not.toBeInTheDocument()
  })

  it('blocks activation while an active workout is in progress', async () => {
    apiMocks.dashboard = { activeSession: { id: 'session-1' } }
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Make active' }))

    expect(apiMocks.activateProgram).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Finish or cancel the active workout before switching programs.')
  })

  it('shows Activating while the activation request is pending', async () => {
    let finishActivation!: () => void
    apiMocks.activateProgram.mockImplementation(() => new Promise<void>((resolve) => {
      finishActivation = () => {
        if (apiMocks.currentProgram) apiMocks.currentProgram = { ...apiMocks.currentProgram, isActive: true }
        resolve()
      }
    }))
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Make active' }))

    const activating = await screen.findByRole('button', { name: 'Activating...' })
    expect(activating).toBeDisabled()
    finishActivation()
    expect(await screen.findByText('Active')).toBeInTheDocument()
  })

  it('keeps the anchored menu dismissible with Escape and restores trigger focus', async () => {
    renderEditor()
    const trigger = await screen.findByRole('button', { name: 'More actions for Upper / Lower' })
    fireEvent.click(trigger)
    const menuItem = await screen.findByRole('menuitem', { name: 'Duplicate program' })
    await waitFor(() => expect(menuItem).toHaveFocus())
    fireEvent.keyDown(menuItem, { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    await screen.findByRole('menu')
    fireEvent.pointerDown(document.body)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('opens the existing delete confirmation and deletes after confirmation', async () => {
    renderEditor()
    await openActions()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete program' }))
    expect(await screen.findByRole('heading', { name: 'Delete Upper / Lower?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete program' }))
    await waitFor(() => expect(apiMocks.deleteProgram).toHaveBeenCalledWith('program-1'))
    expect(await screen.findByRole('heading', { name: 'Programs' })).toHaveFocus()
  })

  it('opens and closes the Reorder days dialog with compact rows, focus restoration, optimistic reordering, and status announcements', async () => {
    const day1: ProgramDay = {
      id: 'day-1',
      name: 'PUSH',
      badgeColor: 'bg-blue-100 text-blue-800',
      order: 1,
      exercises: [
        {
          id: 'day-exercise-1',
          exerciseId: 'exercise-1',
          name: 'Bench Press',
          category: { id: 'category-1', name: 'Chest', isCustom: false },
          order: 1,
        },
        {
          id: 'day-exercise-2',
          exerciseId: 'exercise-2',
          name: 'Overhead Press',
          category: { id: 'category-2', name: 'Shoulders', isCustom: false },
          order: 2,
        },
      ],
    }
    const day2: ProgramDay = {
      id: 'day-2',
      name: 'PULL',
      badgeColor: 'bg-green-100 text-green-800',
      order: 2,
      exercises: [],
    }
    const day3: ProgramDay = {
      id: 'day-3',
      name: 'LEGS',
      badgeColor: 'bg-amber-100 text-amber-800',
      order: 3,
      exercises: [
        {
          id: 'day-exercise-3',
          exerciseId: 'exercise-3',
          name: 'Back Squat',
          category: { id: 'category-3', name: 'Legs', isCustom: false },
          order: 1,
        },
      ],
    }
    apiMocks.currentProgram = {
      id: 'program-1',
      name: 'Upper / Lower',
      isActive: true,
      days: [day1, day2, day3],
    }

    let resolveReorderDown!: (days: ProgramDay[]) => void
    apiMocks.reorderDay.mockImplementationOnce(
      () =>
        new Promise<ProgramDay[]>((resolve) => {
          resolveReorderDown = (days) => {
            if (apiMocks.currentProgram) {
              apiMocks.currentProgram = { ...apiMocks.currentProgram, days }
            }
            resolve(days)
          }
        }),
    )

    renderEditor()

    const addDayTrigger = await screen.findByRole('button', { name: '+ Add Day' })
    const reorderTrigger = await screen.findByRole('button', { name: 'Reorder Days' })
    expect(addDayTrigger.parentElement?.children[0]).toBe(addDayTrigger)
    expect(addDayTrigger.parentElement?.children[1]).toBe(reorderTrigger)
    expect(reorderTrigger).toHaveClass(
      'min-h-11',
      'shrink-0',
      'rounded-[13px]',
      'border',
      'border-slate-200',
      'bg-white',
      'px-3',
      'py-2.5',
      'text-sm',
      'font-semibold',
      'text-slate-700',
    )
    expect(reorderTrigger).toHaveTextContent('Reorder')

    reorderTrigger.focus()
    fireEvent.click(reorderTrigger)

    let dialog = await screen.findByRole('dialog', { name: 'Reorder days' })
    expect(within(dialog).getByText('Upper / Lower')).toBeInTheDocument()

    // Dismiss with Escape and verify focus restores to the Reorder Days button
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Reorder days' })).not.toBeInTheDocument()
    expect(reorderTrigger).toHaveFocus()

    // Reopen and verify compact row structure, step badges, exercise counts, and 44x44px drag handles
    fireEvent.click(reorderTrigger)
    dialog = await screen.findByRole('dialog', { name: 'Reorder days' })

    const pushHandle = within(dialog).getByRole('button', { name: 'Drag PUSH to reorder' })
    const pullHandle = within(dialog).getByRole('button', { name: 'Drag PULL to reorder' })
    const legsHandle = within(dialog).getByRole('button', { name: 'Drag LEGS to reorder' })

    expect(pushHandle).toHaveClass('h-11', 'w-11')
    expect(pullHandle).toHaveClass('h-11', 'w-11')
    expect(legsHandle).toHaveClass('h-11', 'w-11')
    expect(pushHandle).toHaveFocus()
    expect(within(dialog).getByText('2 exercises')).toBeInTheDocument()
    expect(within(dialog).getByText('No exercises')).toBeInTheDocument()
    expect(within(dialog).getByText('1 exercise')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Done' })).toHaveClass('min-h-11', 'w-full')

    // Reorder PUSH down via ArrowDown on its drag handle
    fireEvent.keyDown(pushHandle, { key: 'ArrowDown' })

    await waitFor(() => {
      expect(apiMocks.reorderDay.mock.calls[0]?.[0]).toEqual({
        programId: 'program-1',
        dayId: 'day-1',
        targetIndex: 1,
      })
    })

    // Both modal rows and background program day cards update optimistically
    const modalHandlesWhilePending = within(dialog)
      .getAllByRole('button', { name: /Drag .* to reorder/ })
      .map((button) => button.getAttribute('aria-label'))
    expect(modalHandlesWhilePending).toEqual([
      'Drag PULL to reorder',
      'Drag PUSH to reorder',
      'Drag LEGS to reorder',
    ])

    const editDayButtonsWhilePending = screen
      .getAllByRole('button', { name: /^Edit (PUSH|PULL|LEGS)$/ })
      .map((button) => button.getAttribute('aria-label'))
    expect(editDayButtonsWhilePending).toEqual(['Edit PULL', 'Edit PUSH', 'Edit LEGS'])
    expect(within(dialog).getByRole('status')).toHaveTextContent('Moved PUSH to position 2 of 3.')

    // Pending mutation locks drag handles, Done button, and Escape dismissal
    expect(within(dialog).getByRole('button', { name: 'Drag PUSH to reorder' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeDisabled()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(dialog).toBeInTheDocument()

    resolveReorderDown([
      { ...day2, order: 1 },
      { ...day1, order: 2 },
      { ...day3, order: 3 },
    ])

    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Drag PUSH to reorder' })).not.toBeDisabled())
    expect(within(dialog).getByRole('button', { name: 'Drag PUSH to reorder' })).toHaveFocus()
    expect(within(dialog).getByRole('status')).toHaveTextContent('Moved PUSH to position 2 of 3.')

    // Move LEGS up via ArrowUp on its drag handle
    apiMocks.reorderDay.mockImplementationOnce(async () => {
      const nextDays = [
        { ...day2, order: 1 },
        { ...day3, order: 2 },
        { ...day1, order: 3 },
      ]
      if (apiMocks.currentProgram) {
        apiMocks.currentProgram = { ...apiMocks.currentProgram, days: nextDays }
      }
      return nextDays
    })
    const updatedLegsHandle = within(dialog).getByRole('button', { name: 'Drag LEGS to reorder' })
    updatedLegsHandle.focus()
    fireEvent.keyDown(updatedLegsHandle, { key: 'ArrowUp' })

    await waitFor(() => {
      expect(apiMocks.reorderDay.mock.calls[1]?.[0]).toEqual({
        programId: 'program-1',
        dayId: 'day-3',
        targetIndex: 1,
      })
    })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Drag LEGS to reorder' })).toHaveFocus())
    expect(within(dialog).getByRole('status')).toHaveTextContent('Moved LEGS to position 2 of 3.')

    // Clicking Done closes the dialog and restores focus to the Reorder Days button
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog', { name: 'Reorder days' })).not.toBeInTheDocument()
    expect(reorderTrigger).toHaveFocus()
  })

  it('restores the previous day order and shows an accessible alert when reordering days fails', async () => {
    const day1: ProgramDay = {
      id: 'day-1',
      name: 'Upper',
      badgeColor: 'bg-blue-100 text-blue-800',
      order: 1,
      exercises: [],
    }
    const day2: ProgramDay = {
      id: 'day-2',
      name: 'Lower',
      badgeColor: 'bg-green-100 text-green-800',
      order: 2,
      exercises: [],
    }
    apiMocks.currentProgram = {
      id: 'program-1',
      name: 'Upper / Lower',
      isActive: true,
      days: [day1, day2],
    }

    let rejectReorder!: (error: Error) => void
    apiMocks.reorderDay.mockImplementationOnce(
      () =>
        new Promise<ProgramDay[]>((_resolve, reject) => {
          rejectReorder = reject
        }),
    )

    renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Reorder Days' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reorder days' })
    const upperHandle = within(dialog).getByRole('button', { name: 'Drag Upper to reorder' })
    fireEvent.keyDown(upperHandle, { key: 'ArrowDown' })

    await waitFor(() => {
      expect(apiMocks.reorderDay.mock.calls[0]?.[0]).toEqual({
        programId: 'program-1',
        dayId: 'day-1',
        targetIndex: 1,
      })
    })
    expect(
      screen
        .getAllByRole('button', { name: /^Edit (Upper|Lower)$/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Edit Lower', 'Edit Upper'])

    rejectReorder(new Error('offline'))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Unable to reorder the day. Please try again.')
    expect(
      within(dialog)
        .getAllByRole('button', { name: /Drag .* to reorder/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Drag Upper to reorder', 'Drag Lower to reorder'])
    expect(
      screen
        .getAllByRole('button', { name: /^Edit (Upper|Lower)$/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Edit Upper', 'Edit Lower'])
  })
})
