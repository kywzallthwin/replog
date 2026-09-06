import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutPage } from '../pages/WorkoutPage'
import {
  addSessionExercise,
  addSet,
  addSetChain,
  cancelSession,
  deleteSet,
  finishSession,
  getSession,
  removeSessionExercise,
  swapSessionExercise,
  updateSet,
  type WorkoutExercise,
  type WorkoutSession,
  type WorkoutSet,
} from '../lib/sessions'
import { getExercises, type ExerciseOption } from '../lib/exercises'
import { getActiveProgram, type Program } from '../lib/programs'
import { createTestQueryClient } from './query-client'

vi.mock('../lib/sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sessions')>()

  return {
    ...actual,
    getSession: vi.fn(),
    addSet: vi.fn(),
    addSetChain: vi.fn(),
    updateSet: vi.fn(),
    deleteSet: vi.fn(),
    addSessionExercise: vi.fn(),
    swapSessionExercise: vi.fn(),
    removeSessionExercise: vi.fn(),
    finishSession: vi.fn(),
    cancelSession: vi.fn(),
  }
})

vi.mock('../lib/exercises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/exercises')>()
  return { ...actual, getExercises: vi.fn() }
})

vi.mock('../lib/programs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/programs')>()
  return { ...actual, getActiveProgram: vi.fn() }
})

const mockedGetSession = vi.mocked(getSession)
const mockedAddSet = vi.mocked(addSet)
const mockedAddSetChain = vi.mocked(addSetChain)
const mockedUpdateSet = vi.mocked(updateSet)
const mockedDeleteSet = vi.mocked(deleteSet)
const mockedAddSessionExercise = vi.mocked(addSessionExercise)
const mockedSwapSessionExercise = vi.mocked(swapSessionExercise)
const mockedRemoveSessionExercise = vi.mocked(removeSessionExercise)
const mockedFinishSession = vi.mocked(finishSession)
const mockedCancelSession = vi.mocked(cancelSession)
const mockedGetExercises = vi.mocked(getExercises)
const mockedGetActiveProgram = vi.mocked(getActiveProgram)

function workoutSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: 'set-1',
    kind: 'NORMAL',
    parentSetId: null,
    notes: null,
    weightKg: 80,
    reps: 8,
    order: 0,
    ...overrides,
  }
}

function workoutExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    id: 'session-exercise-1',
    exerciseId: 'bench',
    name: 'Bench Press',
    order: 0,
    sets: [workoutSet()],
    lastTime: null,
    previousWorkout: {
      sessionId: 'previous-session',
      performedAt: '2026-09-02T12:00:00.000Z',
      bestNormalSetId: 'previous-normal',
      sets: [
        workoutSet({ id: 'previous-warmup', kind: 'WARMUP', weightKg: 40, reps: 10, order: 0 }),
        workoutSet({ id: 'previous-normal', weightKg: 77.5, reps: 8, order: 1 }),
        workoutSet({ id: 'previous-drop', kind: 'DROP', parentSetId: 'previous-normal', weightKg: 60, reps: 6, order: 2 }),
      ],
    },
    ...overrides,
  }
}

function workoutSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    programId: 'program-1',
    programName: 'Strength Base',
    dayId: 'day-1',
    dayName: 'Upper A',
    badgeColor: 'bg-blue-100 text-blue-800',
    startedAt: '2026-09-06T08:00:00.000Z',
    endedAt: null,
    durationSec: null,
    exercises: [workoutExercise()],
    ...overrides,
  }
}

const exerciseOptions: ExerciseOption[] = [
  { id: 'bench', name: 'Bench Press', category: 'CHEST' },
  { id: 'row', name: 'Barbell Row', category: 'BACK' },
]

const activeProgram: Program = {
  id: 'program-1',
  name: 'Strength Base',
  isActive: true,
  days: [
    {
      id: 'day-1',
      name: 'Upper A',
      badgeColor: 'bg-blue-100 text-blue-800',
      order: 0,
      exercises: exerciseOptions.map((exercise, order) => ({
        id: `day-exercise-${order}`,
        exerciseId: exercise.id,
        name: exercise.name,
        category: exercise.category,
        order,
      })),
    },
  ],
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderWorkout(session: WorkoutSession = workoutSession()) {
  mockedGetSession.mockResolvedValue(session)
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/workout/session-1']}>
        <Routes>
          <Route path="/workout/:sessionId" element={<WorkoutPage />} />
          <Route path="/dashboard" element={<h1>Dashboard destination</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function getExerciseCard(name = 'Bench Press') {
  const heading = await screen.findByRole('heading', { name })
  const card = heading.closest('article')
  if (!card) throw new Error(`Exercise card for ${name} was not rendered`)
  return card
}

async function openAddSetForm() {
  const card = await getExerciseCard()
  fireEvent.click(within(card).getByRole('button', { name: 'Add Set' }))
  const heading = within(card).getByText('Add Set', { selector: 'p' })
  const form = heading.closest('form')
  if (!form) throw new Error('Add set form was not rendered')
  return { card, form }
}

beforeEach(() => {
  window.localStorage.clear()
  mockedGetExercises.mockResolvedValue(exerciseOptions)
  mockedGetActiveProgram.mockResolvedValue(activeProgram)
  mockedAddSet.mockResolvedValue(workoutSet({ id: 'new-set' }))
  mockedAddSetChain.mockResolvedValue([workoutSet({ id: 'new-chain-set' })])
  mockedUpdateSet.mockResolvedValue(workoutSet())
  mockedDeleteSet.mockResolvedValue(undefined)
  mockedAddSessionExercise.mockResolvedValue(workoutExercise({ id: 'added-exercise', exerciseId: 'row', name: 'Barbell Row', sets: [] }))
  mockedSwapSessionExercise.mockResolvedValue(workoutExercise({ exerciseId: 'row', name: 'Barbell Row', sets: [] }))
  mockedRemoveSessionExercise.mockResolvedValue(undefined)
  mockedFinishSession.mockResolvedValue(workoutSession({ endedAt: '2026-09-06T09:00:00.000Z', durationSec: 3600 }))
  mockedCancelSession.mockResolvedValue(undefined)
})

describe('WorkoutPage regression coverage', () => {
  it('renders active sets and prefills add-set values while showing previous sets', async () => {
    renderWorkout()

    expect(await screen.findByText('Active workout')).toBeInTheDocument()
    const { form } = await openAddSetForm()
    expect(within(form).getByLabelText(/Previous workout sets from/)).toHaveTextContent('wu40×10')
    expect(within(form).getByLabelText(/Previous workout sets from/)).toHaveTextContent('77.5×8×60×6')
    expect(within(form).getByRole('spinbutton', { name: 'Weight kg' })).toHaveValue(80)
    expect(within(form).getAllByRole('spinbutton')[1]).toHaveValue(8)
  })

  it('renders a completed workout as read-only with its summary', async () => {
    renderWorkout(workoutSession({ endedAt: '2026-09-06T09:00:00.000Z', durationSec: 3600 }))

    expect(await screen.findByText('Completed workout')).toBeInTheDocument()
    expect(screen.getByText('Read only')).toBeInTheDocument()
    expect(screen.getByText('640 kg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Set' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit set' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish Workout' })).not.toBeInTheDocument()
  })

  it('submits the single-set payload and reports a rejected add', async () => {
    mockedAddSet.mockRejectedValueOnce(new Error('offline'))
    renderWorkout()
    const { form } = await openAddSetForm()

    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Weight kg' }), { target: { value: '82.5' } })
    fireEvent.change(within(form).getAllByRole('spinbutton')[1], { target: { value: '7' } })
    fireEvent.change(within(form).getByRole('textbox', { name: /Set note/ }), { target: { value: '  Smooth reps  ' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save Set' }))

    await waitFor(() => expect(mockedAddSet.mock.calls[0]?.[0]).toEqual({
      sessionId: 'session-1',
      sessionExerciseId: 'session-exercise-1',
      kind: 'NORMAL',
      notes: 'Smooth reps',
      weightKg: 82.5,
      reps: 7,
    }))
    expect(await within(form).findByText('Unable to add set. Please try again.')).toBeInTheDocument()
  })

  it('removes a drop draft and submits a complete drop chain', async () => {
    renderWorkout()
    const { form } = await openAddSetForm()

    fireEvent.click(within(form).getByText('+ Drop'))
    fireEvent.click(within(form).getByRole('button', { name: 'Remove drop' }))
    expect(within(form).queryByRole('spinbutton', { name: 'Drop weight kg' })).not.toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Save Set' })).toBeInTheDocument()

    fireEvent.click(within(form).getByText('+ Drop'))
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Drop weight kg' }), { target: { value: '60' } })
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Drop reps' }), { target: { value: '6' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save Set + Drops' }))

    await waitFor(() => expect(mockedAddSetChain.mock.calls[0]?.[0]).toEqual({
      sessionId: 'session-1',
      sessionExerciseId: 'session-exercise-1',
      sets: [
        { kind: 'NORMAL', notes: null, weightKg: 80, reps: 8 },
        { kind: 'DROP', weightKg: 60, reps: 6 },
      ],
    }))
    expect(mockedAddSet).not.toHaveBeenCalled()
  })

  it('repeats a simple set and promotes a warm-up to normal', async () => {
    renderWorkout(workoutSession({ exercises: [workoutExercise({ sets: [workoutSet({ kind: 'WARMUP', weightKg: 40, reps: 10 })] })] }))

    fireEvent.click(within(await getExerciseCard()).getByRole('button', { name: 'Repeat last set' }))

    await waitFor(() => expect(mockedAddSet.mock.calls[0]?.[0]).toEqual({
      sessionId: 'session-1',
      sessionExerciseId: 'session-exercise-1',
      kind: 'NORMAL',
      weightKg: 40,
      reps: 10,
    }))
  })

  it('repeats the latest root set and its drop children as a chain', async () => {
    const root = workoutSet({ id: 'root', weightKg: 90, reps: 6, order: 0 })
    const drop = workoutSet({ id: 'drop', kind: 'DROP', parentSetId: 'root', weightKg: 70, reps: 5, order: 1 })
    renderWorkout(workoutSession({ exercises: [workoutExercise({ sets: [root, drop] })] }))

    fireEvent.click(within(await getExerciseCard()).getByRole('button', { name: 'Repeat last set' }))

    await waitFor(() => expect(mockedAddSetChain.mock.calls[0]?.[0]).toEqual({
      sessionId: 'session-1',
      sessionExerciseId: 'session-exercise-1',
      sets: [
        { kind: 'NORMAL', weightKg: 90, reps: 6 },
        { kind: 'DROP', weightKg: 70, reps: 5 },
      ],
    }))
  })

  it('validates edits, submits normalized values, and locks conflicting actions while pending', async () => {
    const request = deferred<WorkoutSet>()
    mockedUpdateSet.mockReturnValueOnce(request.promise)
    renderWorkout()
    const card = await getExerciseCard()
    fireEvent.click(within(card).getByRole('button', { name: 'Edit set' }))
    const form = within(card).getByText('Edit Set').closest('form')
    if (!form) throw new Error('Edit set form was not rendered')

    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Reps' }), { target: { value: '1.5' } })
    fireEvent.submit(form)
    expect(within(form).getByText('Enter valid reps')).toBeInTheDocument()
    expect(mockedUpdateSet).not.toHaveBeenCalled()

    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Weight kg' }), { target: { value: '85' } })
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Reps' }), { target: { value: '9' } })
    fireEvent.change(within(form).getByRole('textbox', { name: /Set note/ }), { target: { value: '  Strong  ' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockedUpdateSet.mock.calls[0]?.[0]).toEqual({
        sessionId: 'session-1',
        sessionExerciseId: 'session-exercise-1',
        setId: 'set-1',
        kind: 'NORMAL',
        notes: 'Strong',
        weightKg: 85,
        reps: 9,
      })
      expect(within(form).getByRole('button', { name: 'Saving...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Finish Workout' })).toBeDisabled()
    })

    request.resolve(workoutSet({ weightKg: 85, reps: 9 }))
    await waitFor(() => expect(within(card).queryByText('Edit Set')).not.toBeInTheDocument())
  })

  it('keeps an edit open and shows an error when saving fails', async () => {
    mockedUpdateSet.mockRejectedValueOnce(new Error('offline'))
    renderWorkout()
    const card = await getExerciseCard()
    fireEvent.click(within(card).getByRole('button', { name: 'Edit set' }))
    fireEvent.click(within(card).getByRole('button', { name: 'Save Changes' }))

    expect(await within(card).findByText('Unable to save set. Please try again.')).toBeInTheDocument()
    expect(within(card).getByText('Edit Set')).toBeInTheDocument()
  })

  it('dismisses set deletion with Escape, then sends its payload and reports failure', async () => {
    mockedDeleteSet.mockRejectedValueOnce(new Error('offline'))
    renderWorkout()
    const card = await getExerciseCard()
    fireEvent.click(within(card).getByRole('button', { name: 'Delete set' }))
    const firstDialog = screen.getByRole('alertdialog', { name: 'Delete 80 kg x 8?' })
    fireEvent.keyDown(firstDialog, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog', { name: 'Delete 80 kg x 8?' })).not.toBeInTheDocument()

    fireEvent.click(within(card).getByRole('button', { name: 'Delete set' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Set' }))

    await waitFor(() => expect(mockedDeleteSet.mock.calls[0]?.[0]).toEqual({
      sessionId: 'session-1',
      sessionExerciseId: 'session-exercise-1',
      setId: 'set-1',
    }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to delete set. Please try again.')
  })

  it('locks exercise removal during submission and sends the removal payload', async () => {
    const request = deferred<void>()
    mockedRemoveSessionExercise.mockReturnValueOnce(request.promise)
    renderWorkout()
    fireEvent.click(within(await getExerciseCard()).getByRole('button', { name: 'Remove Bench Press' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Remove Bench Press?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Exercise' }))

    await waitFor(() => {
      expect(mockedRemoveSessionExercise.mock.calls[0]?.[0]).toEqual({
        sessionId: 'session-1',
        sessionExerciseId: 'session-exercise-1',
      })
      expect(within(dialog).getByRole('button', { name: 'Deleting...' })).toBeDisabled()
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(dialog).toBeInTheDocument()

    request.resolve()
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Remove Bench Press?' })).not.toBeInTheDocument())
  })

  it('opens and dismisses the add picker with focus restoration, then reports add failure', async () => {
    mockedAddSessionExercise.mockRejectedValueOnce(new Error('offline'))
    renderWorkout()
    const trigger = await screen.findByRole('button', { name: '+ Add Exercise' })
    trigger.focus()
    fireEvent.click(trigger)
    let dialog = await screen.findByRole('dialog', { name: 'Choose an exercise' })
    expect(within(dialog).getByRole('searchbox', { name: 'Search exercises' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    dialog = await screen.findByRole('dialog', { name: 'Choose an exercise' })
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Barbell Row' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Exercise' }))

    await waitFor(() => expect(mockedAddSessionExercise.mock.calls[0]?.[0]).toEqual({ sessionId: 'session-1', exerciseId: 'row' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Unable to save exercise change. Please try again.')
  })

  it('submits a swap and closes the picker after success', async () => {
    renderWorkout()
    const trigger = within(await getExerciseCard()).getByRole('button', { name: 'Swap' })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Bench Press' })
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Barbell Row' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Swap' }))

    await waitFor(() => expect(mockedSwapSessionExercise.mock.calls[0]?.[0]).toEqual({
      sessionId: 'session-1',
      sessionExerciseId: 'session-exercise-1',
      exerciseId: 'row',
    }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Bench Press' })).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('reports finish failure and renders the completed result after retry', async () => {
    const completed = workoutSession({ endedAt: '2026-09-06T09:00:00.000Z', durationSec: 3600 })
    mockedFinishSession.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(completed)
    renderWorkout()
    const finish = await screen.findByRole('button', { name: 'Finish Workout' })
    fireEvent.click(finish)
    expect(await screen.findByText('Unable to finish workout. Please try again.')).toBeInTheDocument()

    fireEvent.click(finish)
    await waitFor(() => expect(mockedFinishSession.mock.calls.at(-1)?.[0]).toBe('session-1'))
    expect(await screen.findByText('Read only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish Workout' })).not.toBeInTheDocument()
  })

  it('restores focus when cancel is declined and sends the session id when confirmed', async () => {
    renderWorkout()
    const trigger = await screen.findByRole('button', { name: 'Cancel Workout' })
    trigger.focus()
    fireEvent.click(trigger)
    let dialog = screen.getByRole('alertdialog', { name: 'Cancel this workout?' })
    expect(within(dialog).getByRole('button', { name: 'Keep Workout' })).toHaveFocus()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Workout' }))
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    dialog = screen.getByRole('alertdialog', { name: 'Cancel this workout?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel Workout' }))

    await waitFor(() => expect(mockedCancelSession.mock.calls[0]?.[0]).toBe('session-1'))
    expect(await screen.findByRole('heading', { name: 'Dashboard destination' })).toBeInTheDocument()
  })
})

const longName = 'ExtremelyLongExerciseNameThatMustRemainVisible012345678901234567890123456789'

describe('mobile layout contract', () => {
  it('contains page overflow with safe-area bottom padding', async () => {
    renderWorkout()
    await screen.findByText('Active workout')

    const main = screen.getByRole('main')
    expect(main).toHaveClass('overflow-x-hidden', 'w-full', 'min-w-0')

    const pb = main.className
    expect(pb).toContain('pb-[calc(2rem+env(safe-area-inset-bottom))]')
    expect(pb).not.toContain('py-8')
  })

  it('uses min-w-0 on the session section and summary headings', async () => {
    renderWorkout(workoutSession({ endedAt: '2026-09-06T09:00:00.000Z', durationSec: 3600, dayName: longName, programName: longName }))
    await screen.findByText('Completed workout')

    const section = document.querySelector('section.min-w-0') as HTMLElement
    expect(section).toBeInTheDocument()

    const headings = screen.getAllByRole('heading', { name: longName })
    const summaryHeading = headings.find((h) => h.tagName === 'H2' && h.className.includes('min-w-0'))
    expect(summaryHeading).toBeDefined()
    expect(summaryHeading).toHaveClass('min-w-0', 'break-words')
  })

  it('contains exercise cards and exercise name wrapping', async () => {
    renderWorkout(workoutSession({ exercises: [workoutExercise({ name: longName })] }))
    await screen.findByText(longName)

    const card = (await getExerciseCard(longName)) as HTMLElement
    expect(card).toHaveClass('min-w-0')

    const heading = screen.getByRole('heading', { name: longName })
    expect(heading).toHaveClass('min-w-0', 'break-words')
  })

  it('wraps the previous-set history line instead of scrolling', async () => {
    renderWorkout()
    const { form } = await openAddSetForm()
    const history = within(form).getByLabelText(/Previous workout sets from/)

    expect(history).toHaveClass('rounded-[10px]', 'bg-slate-50', 'px-2.5', 'py-2')
    expect(history.className).not.toContain('overflow-x-auto')
    expect(history.className).not.toContain('min-w-max')

    const inner = history.querySelector('div') as HTMLElement
    expect(inner).toHaveClass('flex', 'min-w-0', 'flex-wrap')
    expect(inner).not.toHaveClass('inline-flex', 'min-w-max')
  })

  it('uses a 44px remove button and min-w-0 grid for drop rows', async () => {
    renderWorkout()
    const { form } = await openAddSetForm()
    fireEvent.click(within(form).getByText('+ Drop'))

    const removeBtn = within(form).getByRole('button', { name: 'Remove drop' })
    expect(removeBtn).toHaveClass('h-11', 'w-11', 'place-items-center')

    const dropRow = removeBtn.closest('div.min-w-0') as HTMLElement
    expect(dropRow).toBeInTheDocument()
    expect(dropRow).toHaveClass('grid', 'min-w-0', 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem]')
  })

  it('preserves 44px controls on set-row edit and delete actions', async () => {
    renderWorkout()
    const card = await getExerciseCard()
    const editBtn = within(card).getByRole('button', { name: 'Edit set' })
    const deleteBtn = within(card).getByRole('button', { name: 'Delete set' })

    expect(editBtn).toHaveClass('h-11', 'w-11')
    expect(deleteBtn).toHaveClass('h-11', 'w-11')
  })

  it('uses min-w-0 and safe-area padding on the page container', async () => {
    renderWorkout()
    await screen.findByText('Active workout')

    const main = screen.getByRole('main')
    const inner = main.querySelector('.max-w-4xl') as HTMLElement
    expect(inner).toHaveClass('w-full', 'min-w-0')
  })
})
