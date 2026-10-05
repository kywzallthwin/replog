import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgramPage } from '../pages/ProgramPage'
import { createTestQueryClient } from './query-client'

const apiMocks = vi.hoisted(() => ({
  currentProgram: null as import('../lib/programs').Program | null,
  getProgram: vi.fn(),
  addDay: vi.fn(),
  updateDay: vi.fn(),
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
  })

  it('shows the editor heading and returns focus to Programs', async () => {
    renderEditor()

    expect(await screen.findByRole('heading', { name: 'Edit Program' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Program' }).every((link) => link.getAttribute('aria-current') === 'page')).toBe(true)
    const programsLink = screen.getByRole('link', { name: 'Programs' })
    expect(programsLink).toHaveAttribute('href', '/program')
    fireEvent.click(programsLink)
    expect(await screen.findByRole('heading', { name: 'Programs' })).toHaveFocus()
  })

  it('clamps long unbroken program names to two lines without horizontal overflow', async () => {
    apiMocks.currentProgram = makeProgram({ name: 'UpperLower'.repeat(16) })
    renderEditor()

    const name = await screen.findByRole('heading', { level: 2, name: 'UpperLower'.repeat(16) })
    expect(name).toHaveStyle({ display: '-webkit-box', WebkitLineClamp: '2', overflow: 'hidden' })
    expect(name).toHaveClass('[overflow-wrap:anywhere]')
  })

  it('shows active state and omits the action-row activation button for the active program', async () => {
    apiMocks.currentProgram = makeProgram({ isActive: true })
    renderEditor()

    expect(await screen.findByText('Active')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make active' })).not.toBeInTheDocument()
    const actionRow = screen.getByRole('button', { name: '+ Add Day' }).parentElement
    expect(actionRow?.children).toHaveLength(2)
    await openActions()
    expect(screen.queryByRole('menuitem', { name: 'Set as active' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Rename program' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Duplicate program' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete program' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('opens Add Day from a full-width action button', async () => {
    renderEditor()

    const addDay = await screen.findByRole('button', { name: '+ Add Day' })
    expect(addDay).toHaveClass('flex-1', 'text-left', 'min-h-11')
    const actionRow = addDay.parentElement
    const activate = screen.getByRole('button', { name: 'Make active' })
    expect(actionRow).toHaveClass('flex', 'flex-wrap')
    expect(actionRow?.children[0]).toBe(addDay)
    expect(actionRow?.children[1]).toBe(activate)
    expect(actionRow?.children[2]).toBe(screen.getByRole('button', { name: 'More actions for Upper / Lower' }))
    expect(activate).toHaveClass('shrink-0', 'min-h-11')
    fireEvent.click(addDay)
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Lower' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiMocks.addDay).toHaveBeenCalledWith({
      programId: 'program-1', name: 'Lower', badgeColor: 'bg-amber-100 text-amber-800',
    }))
  })

  it('keeps day editing available from the existing editor cards', async () => {
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Upper' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Upper Body' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiMocks.updateDay).toHaveBeenCalledWith(expect.objectContaining({
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
      finishActivation = resolve
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
})
