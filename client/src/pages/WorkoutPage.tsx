import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getSession, sessionQueryKey } from '../lib/sessions'

function formatStartedAt(startedAt: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(startedAt))
}

export function WorkoutPage() {
  const { sessionId } = useParams()
  const { data: session, isError, isPending } = useQuery({
    queryKey: sessionQueryKey(sessionId ?? ''),
    queryFn: () => getSession(sessionId ?? ''),
    enabled: Boolean(sessionId),
    retry: false,
  })

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
                      className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Add Set
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-[14px] bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              This is the workout session shell. Set logging, timers, swap, and finish actions come next.
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
