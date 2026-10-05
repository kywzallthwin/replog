import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  getSessionHistory,
  sessionHistoryQueryKey,
  type WorkoutHistorySession,
} from '../lib/sessions'
import { getBadgeClass } from '../lib/badgeColors'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'
import { BrandLogo } from '../components/BrandLogo'
import { PageLoader } from '../components/ui/PageLoader'
import { useNavigate } from 'react-router-dom'

function sessionDate(session: WorkoutHistorySession) {
  return session.source === 'MANUAL' && session.workoutDate
    ? new Date(`${session.workoutDate.slice(0, 10)}T12:00:00`)
    : new Date(session.startedAt)
}

function formatMonth(session: WorkoutHistorySession) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(sessionDate(session))
}

function formatSessionDate(session: WorkoutHistorySession) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(sessionDate(session))
}

function formatDuration(durationSec: number | null) {
  if (durationSec === null) {
    return 'Duration unavailable'
  }

  return `${Math.max(1, Math.round(durationSec / 60))} min`
}

function groupSessionsByMonth(sessions: WorkoutHistorySession[]) {
  const groups: Array<{ month: string; sessions: WorkoutHistorySession[] }> = []

  for (const session of sessions) {
    const month = formatMonth(session)
    const currentGroup = groups[groups.length - 1]

    if (currentGroup?.month === month) {
      currentGroup.sessions.push(session)
    } else {
      groups.push({ month, sessions: [session] })
    }
  }

  return groups
}

export function HistoryPage() {
  const navigate = useNavigate()
  const { data: sessions, isError, isPending } = useQuery({
    queryKey: sessionHistoryQueryKey,
    queryFn: getSessionHistory,
    retry: false,
  })
  const hasCachedSessions = sessions !== undefined
  const isInitialError = isError && !hasCachedSessions
  const isRefreshError = isError && hasCachedSessions
  const groupedSessions = sessions ? groupSessionsByMonth(sessions) : []

  return (
    <main className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-slate-100 px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 lg:py-10">
      <div className="mx-auto w-full min-w-0 max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <BrandLogo className="h-6 w-auto" />
              <button type="button" onClick={() => navigate('/history/log')} className="min-h-11 rounded-[12px] bg-slate-900 px-3 text-sm font-bold text-white shadow-sm">+ Log Workout</button>
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">
              Workout History
            </h1>
          </div>
          <TopNav />
        </header>

        {isPending ? (
          <PageLoader statusMessage="Loading history..." />
        ) : null}

        {isInitialError ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p role="alert" className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to load workout history. Please refresh and try again.
            </p>
          </section>
        ) : null}

        {isRefreshError ? (
          <p role="alert" className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Unable to refresh workout history. Showing previously loaded workouts.
          </p>
        ) : null}

        {sessions && sessions.length === 0 ? (
          <section className="rounded-[28px] bg-white p-6 text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <h2 className="text-lg font-bold text-slate-900">No finished workouts yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Finish a workout and it will appear here with duration, exercises, and set totals.
            </p>
            <Link
              to="/dashboard"
              className="mt-5 inline-flex rounded-[13px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Start from Dashboard
            </Link>
          </section>
        ) : null}

        {groupedSessions.length ? (
          <div className="space-y-8">
            {groupedSessions.map((group) => (
              <section key={group.month}>
                <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  {group.month}
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.sessions.map((session) => (
                    <Link
                      key={session.id}
                      to={`/workout/${session.id}?from=history`}
                      className="min-w-0 rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
                    >
                      <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className={`min-w-0 max-w-full whitespace-normal break-words rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] [overflow-wrap:anywhere] ${getBadgeClass(session.badgeColor)}`}>
                            {session.dayName}
                          </span>
                          {session.source === 'MANUAL' ? <span className="text-[10px] font-semibold text-slate-400">Manually logged</span> : null}
                        </div>
                        <span aria-hidden="true" className="shrink-0 text-lg text-slate-300">{String.fromCharCode(0x203a)}</span>
                      </div>
                      <time dateTime={session.workoutDate ?? session.startedAt} className="block min-w-0 break-words text-base font-bold text-slate-900 [overflow-wrap:anywhere]">
                        {formatSessionDate(session)}
                      </time>
                      <p className="mt-2 min-w-0 break-words text-sm text-slate-500 [overflow-wrap:anywhere]">
                        {session.programName ? `${session.programName} · ` : ''}{session.exerciseCount} exercises · {session.setCount} sets · {formatDuration(session.durationSec)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
      <BottomTabBar />
    </main>
  )
}
