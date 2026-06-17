import type { FormEvent } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  addSet,
  getSession,
  sessionQueryKey,
  type SetKind,
  type WorkoutExercise,
  type WorkoutSet,
} from '../lib/sessions'

function formatStartedAt(startedAt: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(startedAt))
}

function formatSetKind(kind: SetKind, order: number) {
  if (kind === 'WARMUP') {
    return 'WU'
  }

  if (kind === 'DROP') {
    return 'DROP'
  }

  return order.toString()
}

function getSetBadgeClass(kind: SetKind) {
  if (kind === 'WARMUP') {
    return 'bg-slate-200 text-slate-700 italic'
  }

  if (kind === 'DROP') {
    return 'bg-blue-50 text-blue-700'
  }

  return 'bg-slate-100 text-slate-500'
}

function SetRow({ set }: { set: WorkoutSet }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold tracking-[0.04em] ${getSetBadgeClass(set.kind)}`}>
        {formatSetKind(set.kind, set.order)}
      </span>
      <span className="font-bold text-slate-900">{set.weightKg} kg</span>
      <span className="text-xs text-slate-300">x</span>
      <span className="font-medium text-slate-600">{set.reps}</span>
    </div>
  )
}

export function WorkoutPage() {
  const { sessionId } = useParams()
  const queryClient = useQueryClient()
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const [kind, setKind] = useState<SetKind>('NORMAL')
  const [weightKg, setWeightKg] = useState('')
  const [reps, setReps] = useState('')
  const [formError, setFormError] = useState('')
  const { data: session, isError, isPending } = useQuery({
    queryKey: sessionQueryKey(sessionId ?? ''),
    queryFn: () => getSession(sessionId ?? ''),
    enabled: Boolean(sessionId),
    retry: false,
  })
  const addSetMutation = useMutation({
    mutationFn: addSet,
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) })
      }

      setActiveExerciseId(null)
      setKind('NORMAL')
      setWeightKg('')
      setReps('')
      setFormError('')
    },
  })

  function openAddSetForm(exercise: WorkoutExercise) {
    setActiveExerciseId(exercise.id)
    setKind('NORMAL')
    setWeightKg('')
    setReps('')
    setFormError('')
  }

  function handleAddSet(event: FormEvent<HTMLFormElement>, exercise: WorkoutExercise) {
    event.preventDefault()
    setFormError('')

    if (!sessionId) {
      setFormError('Missing workout session')
      return
    }

    const parsedWeightKg = Number(weightKg)
    const parsedReps = Number(reps)

    if (!Number.isFinite(parsedWeightKg) || parsedWeightKg < 0) {
      setFormError('Enter a valid weight')
      return
    }

    if (!Number.isInteger(parsedReps) || parsedReps < 1) {
      setFormError('Enter valid reps')
      return
    }

    addSetMutation.mutate({
      sessionId,
      sessionExerciseId: exercise.id,
      kind,
      weightKg: parsedWeightKg,
      reps: parsedReps,
    })
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <Link to="/dashboard" className="text-sm font-semibold text-slate-900">
            Dashboard
          </Link>
          <h1 className="text-[15px] font-bold text-slate-900">
            {session?.dayName ?? 'Workout'}
          </h1>
          <div className="w-[72px]" />
        </header>

        {isPending ? (
          <section className="p-6">
            <p className="text-sm font-semibold text-slate-500">Loading workout...</p>
          </section>
        ) : null}

        {isError ? (
          <section className="p-6">
            <p className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to load this workout session.
            </p>
          </section>
        ) : null}

        {session ? (
          <section className="p-5 sm:p-6">
            <div className="mb-5 rounded-[20px] bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Active workout</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-900">
                {session.dayName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Started {formatStartedAt(session.startedAt)} · {session.exercises.length} exercises
              </p>
            </div>

            <div className="space-y-3">
              {session.exercises.map((exercise, index) => (
                <article
                  key={exercise.id}
                  className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Exercise {index + 1}
                      </p>
                      <h3 className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-900">
                        {exercise.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {exercise.sets.length ? `${exercise.sets.length} sets logged` : 'No sets yet'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddSetForm(exercise)}
                      className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Add Set
                    </button>
                  </div>
                  {exercise.sets.length ? (
                    <div className="mt-3 rounded-[12px] bg-slate-50 px-3 py-1">
                      {exercise.sets.map((set) => (
                        <SetRow key={set.id} set={set} />
                      ))}
                    </div>
                  ) : null}
                  {activeExerciseId === exercise.id ? (
                    <form
                      onSubmit={(event) => handleAddSet(event, exercise)}
                      className="mt-3 rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                    >
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Add Set</p>
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Kind</span>
                          <select
                            value={kind}
                            onChange={(event) => setKind(event.target.value as SetKind)}
                            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900"
                          >
                            <option value="NORMAL">Normal</option>
                            <option value="WARMUP">Warm-up</option>
                            <option value="DROP">Drop</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Weight kg</span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={weightKg}
                            onChange={(event) => setWeightKg(event.target.value)}
                            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                            required
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Reps</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={reps}
                            onChange={(event) => setReps(event.target.value)}
                            className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                            required
                          />
                        </label>
                      </div>
                      {formError || addSetMutation.isError ? (
                        <p className="mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                          {formError || 'Unable to add set. Please try again.'}
                        </p>
                      ) : null}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="submit"
                          disabled={addSetMutation.isPending}
                          className="rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                        >
                          {addSetMutation.isPending ? 'Saving...' : 'Save Set'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveExerciseId(null)}
                          className="rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-[14px] bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              Set logging is live. Timers, swap, and finish actions come next.
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
