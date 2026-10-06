import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ManualProgramPickerDialog } from '../components/programs/ManualProgramPickerDialog'
import { ManualWorkoutPage } from '../pages/ManualWorkoutPage'
import { createManualSession, getManualDraft, type WorkoutSession } from '../lib/sessions'
import { getProgram, getPrograms, type Program, type ProgramSummary } from '../lib/programs'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/programs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/programs')>()),
  getProgram: vi.fn(),
  getPrograms: vi.fn(),
}))
vi.mock('../lib/sessions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/sessions')>()),
  createManualSession: vi.fn(),
  getManualDraft: vi.fn(),
}))

const mockedGetProgram = vi.mocked(getProgram)
const mockedGetPrograms = vi.mocked(getPrograms)
const mockedCreateManualSession = vi.mocked(createManualSession)
const mockedGetManualDraft = vi.mocked(getManualDraft)
const selectedWorkout = vi.fn()

const programs: ProgramSummary[] = [
  { id: 'inactive', name: 'PPL (Push Pull Legs)', isActive: false, dayCount: 2, exerciseCount: 8 },
  { id: 'empty', name: 'Empty plan', isActive: false, dayCount: 0, exerciseCount: 0 },
  { id: 'active', name: 'PHUL', isActive: true, dayCount: 1, exerciseCount: 4 },
  { id: 'other', name: 'Upper', isActive: false, dayCount: 1, exerciseCount: 4 },
]

function fullProgram(id: string, name: string, days: Array<{ id: string; name: string; order: number }>): Program {
  return {
    id,
    name,
    isActive: id === 'active',
    days: days.map((day) => ({ ...day, badgeColor: 'neutral', exercises: [] })),
  }
}

function PickerHarness() {
  const [isOpen, setOpen] = useState(false)
  const [isCreating, setCreating] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>From Program</button>
    {isOpen ? <ManualProgramPickerDialog
      onClose={() => { setOpen(false); setCreating(false) }}
      onSelectWorkout={(dayId) => { selectedWorkout(dayId); setCreating(true) }}
      isCreating={isCreating}
      createError={false}
      triggerRef={triggerRef}
    /> : null}
  </>
}

function renderPicker() {
  const queryClient = createTestQueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={queryClient}><PickerHarness /></QueryClientProvider>)
}

beforeEach(() => {
  mockedGetProgram.mockReset()
  mockedGetPrograms.mockReset()
  mockedCreateManualSession.mockReset()
  mockedGetManualDraft.mockReset()
  selectedWorkout.mockReset()
  mockedGetPrograms.mockResolvedValue(programs)
  mockedGetManualDraft.mockResolvedValue(null)
  mockedGetProgram.mockImplementation(async (id) => id === 'active'
    ? fullProgram('active', 'PHUL', [{ id: 'day-phul', name: 'PHUL Day 1', order: 1 }])
    : fullProgram(id, 'PPL', [
      { id: 'day-one', name: 'Day 1', order: 1 },
      { id: 'day-two', name: 'Day 2', order: 2 },
    ]))
})

describe('manual program picker dialog', () => {
  it('filters zero-day programs, keeps active first and preserves the remaining API order', async () => {
    renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'From Program' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('PHUL')).toBeInTheDocument()
    expect(within(dialog).queryByText('Empty plan')).not.toBeInTheDocument()
    const cardButtons = within(dialog).getAllByRole('button').filter((button) => button.textContent?.includes('workout day'))
    expect(cardButtons.map((button) => button.querySelector('span > span')?.textContent)).toEqual(['PHUL', 'PPL (Push Pull Legs)', 'Upper'])
    expect(mockedGetProgram).not.toHaveBeenCalled()
  })

  it('loads only the selected program, preserves stored day order, and prevents duplicate selection while creating', async () => {
    renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'From Program' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(await within(dialog).findByRole('button', { name: /PPL \(Push Pull Legs\)/ }))
    expect(await within(dialog).findByRole('heading', { name: 'Choose Workout' })).toHaveFocus()
    expect(mockedGetProgram).toHaveBeenCalledTimes(1)
    expect(mockedGetProgram).toHaveBeenCalledWith('inactive')
    const dayButtons = await within(dialog).findAllByRole('button', { name: /Day [12]/ })
    expect(dayButtons.map((button) => button.textContent?.trim())).toEqual(['Day 1', 'Day 2'])
    fireEvent.click(dayButtons[0])
    await waitFor(() => expect(selectedWorkout).toHaveBeenCalledWith('day-one'))
    expect(within(dialog).getByRole('button', { name: /^Back$/ })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Opening workout…' })).toBeDisabled()
    expect(dayButtons[1]).toBeDisabled()
  })

  it('returns to program selection, closes on Escape, restores focus, and reopens at Choose Program', async () => {
    renderPicker()
    const trigger = screen.getByRole('button', { name: 'From Program' })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(await within(dialog).findByRole('button', { name: /PHUL/ }))
    expect(await within(dialog).findByRole('heading', { name: 'Choose Workout' })).toHaveFocus()
    const footerBack = within(dialog).getByRole('button', { name: /^Back$/ })
    expect(footerBack).not.toHaveTextContent('PHUL')
    expect(within(dialog).queryByRole('button', { name: 'Back to Choose Program' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('PHUL').closest('button')).not.toBe(footerBack)
    expect(within(dialog).getByRole('button', { name: /^Back$/ })).toBeInTheDocument()
    fireEvent.click(footerBack)
    expect(await within(dialog).findByRole('button', { name: /PHUL/ })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
    fireEvent.click(trigger)
    expect(await screen.findByRole('heading', { name: 'Choose Program' })).toHaveFocus()
  })

  it('traps Tab focus and disables Escape dismissal while a workout is opening', async () => {
    renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'From Program' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.click(await within(dialog).findByRole('button', { name: /PHUL/ }))
    const dayButton = await within(dialog).findByRole('button', { name: 'PHUL Day 1' })
    fireEvent.click(dayButton)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Opening workout…' })).toBeDisabled()
  })

  it('offers retry after a program-list request fails', async () => {
    mockedGetPrograms.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce(programs)
    renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'From Program' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Unable to load programs')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }))
    expect(await within(dialog).findByText('PHUL')).toBeInTheDocument()
  })

  it('keeps the setup date and opens the shared manual editor after workout selection', async () => {
    const manualSession: WorkoutSession = {
      id: 'manual-session', programId: 'active', programName: 'PHUL', dayId: 'day-phul', dayName: 'PHUL Day 1',
      badgeColor: 'neutral', startedAt: '2025-12-25T12:00:00.000Z', endedAt: null, durationSec: null,
      source: 'MANUAL', workoutDate: '2025-12-25', notes: null, exercises: [],
    }
    mockedCreateManualSession.mockResolvedValue(manualSession)
    const queryClient = createTestQueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/history/log?date=2025-12-25']}><Routes>
      <Route path="/history/log" element={<ManualWorkoutPage />} />
      <Route path="/workout/:sessionId" element={<p>Shared manual editor</p>} />
    </Routes></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'From Program' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(await within(dialog).findByRole('button', { name: /PHUL/ }))
    fireEvent.click(await within(dialog).findByRole('button', { name: 'PHUL Day 1' }))
    expect(await screen.findByText('Shared manual editor')).toBeInTheDocument()
    expect(mockedCreateManualSession).toHaveBeenCalledWith({ dayId: 'day-phul', workoutDate: '2025-12-25' })
  })

  it('keeps Resume Draft available and starts Blank Workout without a program day', async () => {
    const manualSession: WorkoutSession = {
      id: 'existing-draft', programId: null, programName: null, dayId: null, dayName: '',
      badgeColor: '', startedAt: '2025-12-25T12:00:00.000Z', endedAt: null, durationSec: null,
      source: 'MANUAL', workoutDate: '2025-12-25', notes: null, exercises: [],
    }
    mockedGetManualDraft.mockResolvedValue(manualSession)
    mockedCreateManualSession.mockResolvedValue({ ...manualSession, id: 'blank-session' })
    const queryClient = createTestQueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/history/log?date=2025-12-25']}><Routes>
      <Route path="/history/log" element={<ManualWorkoutPage />} />
      <Route path="/workout/:sessionId" element={<p>Shared manual editor</p>} />
    </Routes></MemoryRouter></QueryClientProvider>)

    const resumeLink = await screen.findByRole('link', { name: /Resume draft/ })
    expect(resumeLink).toHaveAttribute('href', '/workout/existing-draft?from=manual')
    fireEvent.click(screen.getByRole('button', { name: /Blank Workout/ }))
    expect(await screen.findByText('Shared manual editor')).toBeInTheDocument()
    expect(mockedCreateManualSession).toHaveBeenCalledWith({ dayId: undefined, workoutDate: '2025-12-25' })
  })

  it('keeps the workout step and allows retry after manual session creation fails', async () => {
    mockedCreateManualSession.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce({
      id: 'retry-session', programId: 'active', programName: 'PHUL', dayId: 'day-phul', dayName: 'PHUL Day 1',
      badgeColor: 'neutral', startedAt: '2025-12-25T12:00:00.000Z', endedAt: null, durationSec: null,
      source: 'MANUAL', workoutDate: '2025-12-25', notes: null, exercises: [],
    })
    const queryClient = createTestQueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/history/log?date=2025-12-25']}><Routes>
      <Route path="/history/log" element={<ManualWorkoutPage />} />
      <Route path="/workout/:sessionId" element={<p>Shared manual editor</p>} />
    </Routes></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'From Program' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(await within(dialog).findByRole('button', { name: /PHUL/ }))
    const day = await within(dialog).findByRole('button', { name: 'PHUL Day 1' })
    fireEvent.click(day)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Unable to start a manual workout')
    expect(await screen.findByLabelText('Workout date')).toHaveValue('2025-12-25')
    expect(within(dialog).getByRole('heading', { name: 'Choose Workout' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'PHUL Day 1' }))
    expect(await screen.findByText('Shared manual editor')).toBeInTheDocument()
    expect(mockedCreateManualSession).toHaveBeenCalledTimes(2)
  })
})
