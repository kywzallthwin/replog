import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getProgress, progressQueryKey } from '../lib/progress'

function formatFullDate(startedAt: string) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(startedAt))
}

function formatShortDate(startedAt: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(startedAt))
}

function formatWeight(weightKg: number) {
  return `${Number.isInteger(weightKg) ? weightKg : weightKg.toFixed(1)} kg`
}

function formatEstimatedWeight(weightKg: number) {
  return `${Number.isInteger(weightKg) ? weightKg : weightKg.toFixed(1)} kg`
}

function formatProgress(progressKg: number) {
  if (progressKg === 0) {
    return '0 kg'
  }

  const formattedValue = Number.isInteger(progressKg) ? Math.abs(progressKg) : Math.abs(progressKg).toFixed(1)

  return `${progressKg > 0 ? '+' : '-'}${formattedValue} kg`
}

export function ProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const exerciseId = searchParams.get('exerciseId')
  const { data: progress, isError, isPending } = useQuery({
    queryKey: progressQueryKey(exerciseId),
    queryFn: () => getProgress(exerciseId),
    retry: false,
  })

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/dashboard" className="text-sm font-semibold text-slate-500 transition hover:text-slate-900">
              Dashboard
            </Link>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">Progress</h1>
          </div>
          <select
            value={progress?.selectedExercise?.id ?? ''}
            disabled={!progress?.exercises.length}
            onChange={(event) => setSearchParams({ exerciseId: event.target.value })}
            className="h-11 w-full rounded-[13px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.08)] outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:text-slate-400 sm:w-[260px]"
          >
            {progress?.exercises.length ? null : <option value="">No exercise data</option>}
            {progress?.exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </header>

        {isPending ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="text-sm font-semibold text-slate-500">Loading progress...</p>
          </section>
        ) : null}

        {isError ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to load progress. Please refresh and try again.
            </p>
          </section>
        ) : null}

        {progress && !progress.selectedExercise ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="text-sm font-semibold text-slate-900">No finished sets yet.</p>
            <p className="mt-1 text-sm text-slate-500">Complete a workout with normal working sets to see exercise progress here.</p>
          </section>
        ) : null}

        {progress?.selectedExercise ? (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section>
              <div className="mb-4 rounded-[24px] border border-green-200 bg-green-50 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-green-600">Estimated 1RM PB</p>
                {progress.personalBest ? (
                  <>
                    <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-900">
                      {formatEstimatedWeight(progress.personalBest.estimatedOneRepMaxKg)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      From {formatWeight(progress.personalBest.weightKg)} x {progress.personalBest.reps} reps · {formatFullDate(progress.personalBest.startedAt)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No estimated 1RM yet.</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                  <div className="text-2xl font-extrabold tracking-[-0.03em] text-slate-900">{progress.stats.sessionCount}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Sessions</div>
                </div>
                <div className="rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                  <div className="text-2xl font-extrabold tracking-[-0.03em] text-slate-900">{formatProgress(progress.stats.progressKg)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Progress</div>
                </div>
                <div className="rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                  <div className="text-2xl font-extrabold tracking-[-0.03em] text-slate-900">{formatWeight(progress.stats.heaviestWeightKg)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Heaviest Set</div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-900">Session History</h2>
                  <p className="mt-1 text-xs text-slate-500">{progress.selectedExercise.name}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  {progress.selectedExercise.category}
                </span>
              </div>

              {progress.sessionHistory.length ? (
                <>
                  <div className="overflow-hidden rounded-[14px] border border-slate-100">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Top Set</th>
                          <th className="px-4 py-3">Est. 1RM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {progress.sessionHistory.map((session) => (
                          <tr key={session.sessionId} className="text-slate-700">
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              <Link to={`/workout/${session.sessionId}`} className="transition hover:text-slate-500">
                                {formatShortDate(session.startedAt)}
                              </Link>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">
                              {formatWeight(session.topSet.weightKg)} x {session.topSet.reps}
                            </td>
                            <td className="px-4 py-3">{formatEstimatedWeight(session.topSet.estimatedOneRepMaxKg)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[14px] bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">Estimated 1RM trend:</span>
                    <span>{progress.trendEstimatedOneRepMaxKg.map((weightKg) => Number.isInteger(weightKg) ? weightKg : weightKg.toFixed(1)).join(' -> ')} kg</span>
                    <span className={progress.stats.progressKg >= 0 ? 'font-bold text-green-600' : 'font-bold text-red-500'}>
                      {progress.stats.progressKg >= 0 ? 'up' : 'down'}
                    </span>
                  </div>
                </>
              ) : (
                <p className="rounded-[14px] bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No completed sessions have sets for this exercise yet.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  )
}
