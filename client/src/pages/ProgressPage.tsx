import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getProgress, progressQueryKey } from '../lib/progress'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { FluidSelect } from '../components/forms/FluidSelect'
import { TopNav } from '../components/nav/TopNav'
import { BrandLogo } from '../components/BrandLogo'
import { PageLoader } from '../components/ui/PageLoader'

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

function formatTrendValue(weightKg: number) {
  return Number.isInteger(weightKg) ? weightKg : weightKg.toFixed(1)
}

function getTrendLabel(progressKg: number, sessionCount: number) {
  if (sessionCount < 2 || progressKg === 0) {
    return 'steady'
  }

  return progressKg > 0 ? 'up' : 'down'
}

export function ProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const exerciseId = searchParams.get('exerciseId')
  const { data: progress, isError, isPending } = useQuery({
    queryKey: progressQueryKey(exerciseId),
    queryFn: () => getProgress(exerciseId),
    retry: false,
  })
  const hasCachedProgress = progress !== undefined
  const isInitialError = isError && !hasCachedProgress
  const isRefreshError = isError && hasCachedProgress
  const exercises = progress?.exercises ?? []
  const selectedExercise = progress?.selectedExercise
  const exercisePlaceholder = isPending
    ? 'Loading exercise data'
    : isInitialError
      ? 'Exercise data unavailable'
      : 'No exercise data'

  return (
    <main className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-slate-100 px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 lg:py-10">
      <div className="mx-auto w-full min-w-0 max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/dashboard"
              aria-label="Back to dashboard"
              className="inline-flex min-h-11 items-center"
            >
              <BrandLogo className="h-6 w-auto" />
            </Link>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">Progress</h1>
          </div>
          <TopNav />
          <div className="w-full sm:w-[260px]">
            <FluidSelect
              value={selectedExercise?.id ?? ''}
              options={exercises.map((exercise) => ({ value: exercise.id, label: exercise.name }))}
              onValueChange={(nextExerciseId) => setSearchParams({ exerciseId: nextExerciseId })}
              ariaLabel="Select exercise"
              placeholder={exercisePlaceholder}
              disabled={!exercises.length}
            />
          </div>
        </header>

        {isPending ? (
          <PageLoader statusMessage="Loading progress..." />
        ) : null}

        {isInitialError ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p role="alert" className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to load progress. Please refresh and try again.
            </p>
          </section>
        ) : null}

        {isRefreshError ? (
          <p role="alert" className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Unable to refresh progress. Showing previously loaded values.
          </p>
        ) : null}

        {progress && !progress.selectedExercise ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <h2 className="text-sm font-semibold text-slate-900">No finished sets yet.</h2>
            <p className="mt-1 text-sm text-slate-500">Complete a workout with normal working sets to see exercise progress here.</p>
          </section>
        ) : null}

        {progress?.selectedExercise ? (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="min-w-0">
              <div className="mb-4 min-w-0 rounded-[24px] border border-green-200 bg-green-50 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-green-700">Estimated 1RM PB</p>
                {progress.personalBest ? (
                  <>
                    <h2 className="mt-2 min-w-0 break-words text-3xl font-extrabold tracking-[-0.04em] text-slate-900 [overflow-wrap:anywhere]">
                      {formatEstimatedWeight(progress.personalBest.estimatedOneRepMaxKg)}
                    </h2>
                    <Link
                      to={`/workout/${progress.personalBest.sessionId}?from=progress&exerciseId=${encodeURIComponent(selectedExercise?.id ?? '')}`}
                      className="mt-1 inline-flex min-h-11 max-w-full min-w-0 items-center break-words text-sm text-slate-500 [overflow-wrap:anywhere] transition hover:text-slate-900"
                    >
                      From {formatWeight(progress.personalBest.weightKg)} x {progress.personalBest.reps} reps · {formatFullDate(progress.personalBest.startedAt)}
                    </Link>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No estimated 1RM yet.</p>
                )}
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="min-w-0 rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                  <div className="min-w-0 break-words text-2xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">{progress.stats.sessionCount}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">Sessions</div>
                </div>
                <div className="min-w-0 rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                  <div className="min-w-0 break-words text-2xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">{formatProgress(progress.stats.progressKg)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">Progress</div>
                </div>
                <div className="col-span-2 min-w-0 rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:col-span-1">
                  <div className="min-w-0 break-words text-2xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">{formatWeight(progress.stats.heaviestWeightKg)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">Heaviest Set</div>
                </div>
              </div>
            </section>

            <section className="min-w-0 rounded-[24px] bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
              <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-bold text-slate-900">Session History</h2>
                  <p className="mt-1 min-w-0 break-words text-xs text-slate-500 [overflow-wrap:anywhere]">{progress.selectedExercise.name}</p>
                </div>
                <span className="max-w-full shrink-0 whitespace-normal break-words rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500 [overflow-wrap:anywhere]">
                  {progress.selectedExercise.category}
                </span>
              </div>

              {progress.sessionHistory.length ? (
                <>
                  <div className="space-y-2 sm:hidden">
                    {progress.sessionHistory.map((session) => (
                      <Link
                        key={session.sessionId}
                        to={`/workout/${session.sessionId}?from=progress&exerciseId=${encodeURIComponent(selectedExercise?.id ?? '')}`}
                        aria-label={`${selectedExercise?.name ?? ''}, ${formatShortDate(session.startedAt)}: ${formatWeight(session.topSet.weightKg)} x ${session.topSet.reps}, estimated 1RM ${formatEstimatedWeight(session.topSet.estimatedOneRepMaxKg)}`}
                        className="block min-w-0 rounded-[14px] border border-slate-100 bg-slate-50 p-3 transition hover:bg-slate-100"
                      >
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <time dateTime={session.startedAt} className="inline-flex min-h-11 min-w-11 max-w-full items-center break-words font-semibold text-slate-900 [overflow-wrap:anywhere]">
                            {formatShortDate(session.startedAt)}
                          </time>
                          <span aria-hidden="true" className="shrink-0 text-lg text-slate-300">{String.fromCharCode(0x203a)}</span>
                        </div>
                        <dl className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-sm">
                          <div className="min-w-0">
                            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Top Set</dt>
                            <dd className="mt-1 min-w-0 break-words font-bold text-slate-900 [overflow-wrap:anywhere]">{formatWeight(session.topSet.weightKg)} x {session.topSet.reps}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Est. 1RM</dt>
                            <dd className="mt-1 min-w-0 break-words text-slate-700 [overflow-wrap:anywhere]">{formatEstimatedWeight(session.topSet.estimatedOneRepMaxKg)}</dd>
                          </div>
                        </dl>
                      </Link>
                    ))}
                  </div>

                  <div className="hidden overflow-hidden rounded-[14px] border border-slate-100 sm:block">
                    <table className="w-full min-w-0 text-left text-sm">
                      <caption className="sr-only">Session history for {selectedExercise?.name ?? ''}</caption>
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                        <tr>
                          <th scope="col" className="px-4 py-3">Date</th>
                          <th scope="col" className="px-4 py-3">Top Set</th>
                          <th scope="col" className="px-4 py-3">Est. 1RM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {progress.sessionHistory.map((session) => (
                          <tr key={session.sessionId} className="text-slate-700">
                            <td className="min-w-0 px-4 py-3 font-semibold text-slate-900">
                              <Link
                                to={`/workout/${session.sessionId}?from=progress&exerciseId=${encodeURIComponent(selectedExercise?.id ?? '')}`}
                                aria-label={`${selectedExercise?.name ?? ''}, ${formatShortDate(session.startedAt)}: ${formatWeight(session.topSet.weightKg)} x ${session.topSet.reps}, estimated 1RM ${formatEstimatedWeight(session.topSet.estimatedOneRepMaxKg)}`}
                                className="flex min-h-11 min-w-11 max-w-full items-center break-words transition hover:text-slate-500 [overflow-wrap:anywhere]"
                              >
                                <time dateTime={session.startedAt}>{formatShortDate(session.startedAt)}</time>
                              </Link>
                            </td>
                            <td className="min-w-0 break-words px-4 py-3 font-bold text-slate-900 [overflow-wrap:anywhere]">
                              {formatWeight(session.topSet.weightKg)} x {session.topSet.reps}
                            </td>
                            <td className="min-w-0 break-words px-4 py-3 [overflow-wrap:anywhere]">{formatEstimatedWeight(session.topSet.estimatedOneRepMaxKg)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div
                    role="group"
                    aria-label={`Estimated 1RM trend: ${progress.trendEstimatedOneRepMaxKg.map((weightKg) => `${formatTrendValue(weightKg)} kg`).join(' to ')}; ${getTrendLabel(progress.stats.progressKg, progress.stats.sessionCount)}`}
                    className="mt-4 flex min-w-0 flex-wrap items-center gap-2 rounded-[14px] bg-slate-50 px-4 py-3 text-sm text-slate-600"
                  >
                    <span className="font-semibold text-slate-700">Estimated 1RM trend:</span>
                    <ol aria-label="Estimated 1RM values in chronological order" className="flex min-w-0 flex-wrap items-center gap-1">
                      {progress.trendEstimatedOneRepMaxKg.map((weightKg, index) => (
                        <li key={`${weightKg}-${index}`} className="flex min-w-0 items-center gap-1">
                          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{formatTrendValue(weightKg)} kg</span>
                          {index < progress.trendEstimatedOneRepMaxKg.length - 1 ? <span aria-hidden="true">-&gt;</span> : null}
                        </li>
                      ))}
                    </ol>
                    <span className={progress.stats.progressKg > 0 ? 'font-bold text-green-700' : progress.stats.progressKg < 0 ? 'font-bold text-red-700' : 'font-bold text-slate-600'}>
                      {getTrendLabel(progress.stats.progressKg, progress.stats.sessionCount)}
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
      <BottomTabBar />
    </main>
  )
}
