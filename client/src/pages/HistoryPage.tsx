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

function formatMonth(startedAt: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(startedAt))
}

function formatSessionDate(startedAt: string) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(startedAt))
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
    const month = formatMonth(session.startedAt)
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
  const { data: sessions, isError, isPending } = useQuery({
    queryKey: sessionHistoryQueryKey,
    queryFn: getSessionHistory,
    retry: false,
  })
  const groupedSessions = sessions ? groupSessionsByMonth(sessions) : []

  return (
    <main className="min-h-dvh bg-slate-100 px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <BrandLogo className="h-6 w-auto" />
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">
              Workout History
            </h1>
          </div>
          <TopNav />
        </header>

        {isPending ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="text-sm font-semibold text-slate-500">Loading history...</p>
          </section>
        ) : null}

        {isError ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to load workout history. Please refresh and try again.
            </p>
          </section>
        ) : null}

        {sessions && sessions.length === 0 ? (
          <section className="rounded-[28px] bg-white p-6 text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="text-lg font-bold text-slate-900">No finished workouts yet</p>
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
                      className="rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] ${getBadgeClass(session.badgeColor)}`}>
                          {session.dayName}
                        </span>
                        <span className="text-lg text-slate-300">{String.fromCharCode(0x203a)}</span>
                      </div>
                      <p className="text-base font-bold text-slate-900">
                        {formatSessionDate(session.startedAt)}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
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
