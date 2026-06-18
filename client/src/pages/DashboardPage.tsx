import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardQueryKey, getDashboard } from '../lib/dashboard'
import { authMeQueryKey, getCurrentUser, logoutUser } from '../lib/auth'
import { startSession } from '../lib/sessions'

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Good morning'
  }

  if (hour < 18) {
    return 'Good afternoon'
  }

  return 'Good evening'
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatSessionDate(startedAt: string) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(startedAt))
}

function formatDuration(durationSec: number | null) {
  if (!durationSec) {
    return 'In progress'
  }

  return `${Math.round(durationSec / 60)} min`
}

function formatVolume(totalVolumeKg: number) {
  if (totalVolumeKg >= 1000) {
    return `${(totalVolumeKg / 1000).toFixed(1)}k`
  }

  return Math.round(totalVolumeKg).toString()
}

export function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: getCurrentUser,
    retry: false,
  })
  const { data: dashboard, isError, isPending } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: getDashboard,
    retry: false,
  })
  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: authMeQueryKey })
      navigate('/login', { replace: true })
    },
  })
  const startSessionMutation = useMutation({
    mutationFn: startSession,
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
      navigate(`/workout/${session.id}`)
    },
  })

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">RepLog</p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition hover:bg-slate-50"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {user?.avatarInitial ?? 'U'}
              </span>
              <span className="hidden sm:inline">{user?.username ?? 'Profile'}</span>
            </Link>
            <button
              type="button"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              className="rounded-[13px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </header>

        <div className="mb-5">
          <h2 className="text-xl font-extrabold tracking-[-0.03em] text-slate-900">
            {getGreeting()}{user ? `, ${user.username}` : ''}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{formatDate(new Date())}</p>
        </div>

        {isPending ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="text-sm font-semibold text-slate-500">Loading dashboard...</p>
          </section>
        ) : null}

        {isError ? (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <p className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to load dashboard. Please refresh and try again.
            </p>
          </section>
        ) : null}

        {dashboard ? (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <section className="mb-5 rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Suggested today</p>
                {dashboard.suggestedDay ? (
                  <>
                    <h3 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-900">
                      {dashboard.suggestedDay.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {dashboard.suggestedDay.exerciseCount} exercises
                      {dashboard.suggestedDay.categories.length
                        ? ` · ${dashboard.suggestedDay.categories.join(' + ')}`
                        : ''}
                    </p>
                    <button
                      type="button"
                      disabled={startSessionMutation.isPending}
                      onClick={() => {
                        if (dashboard.suggestedDay) {
                          startSessionMutation.mutate(dashboard.suggestedDay.id)
                        }
                      }}
                      className="mt-5 w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800"
                    >
                      {startSessionMutation.isPending ? 'Starting...' : 'Start Workout'}
                    </button>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No routine days yet.</p>
                )}
              </section>

              <section className="mb-5">
                <p className="mb-2 text-sm font-medium text-slate-500">Or pick a day:</p>
                <div className="flex flex-wrap gap-2">
                  {dashboard.activeProgram?.days.map((day) => (
                    <button
                      type="button"
                      key={day.id}
                      disabled={startSessionMutation.isPending}
                      onClick={() => startSessionMutation.mutate(day.id)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-slate-900 hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {day.name}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-slate-400">Recent Sessions</h3>
                <div className="space-y-3">
                  {dashboard.recentSessions.length ? (
                    dashboard.recentSessions.map((session) => (
                      <Link
                        key={session.id}
                        to={`/workout/${session.id}`}
                        className="flex items-center justify-between rounded-[16px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {formatSessionDate(session.startedAt)}{' '}
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                              {session.dayName}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {session.exerciseCount} exercises · {formatDuration(session.durationSec)}
                          </p>
                        </div>
                        <span className="text-lg text-slate-300">{String.fromCharCode(0x203a)}</span>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-[16px] bg-white p-4 text-sm text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                      No sessions logged yet. Start with the suggested routine above.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="rounded-[24px] bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)] lg:self-start">
              <p className="mb-4 text-[13px] font-bold text-slate-900">Your Stats</p>
              <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                <div className="rounded-[16px] bg-slate-50 p-4">
                  <div className="text-2xl font-extrabold tracking-[-0.03em] text-slate-900">{dashboard.stats.workoutCount}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Workouts</div>
                </div>
                <div className="rounded-[16px] bg-slate-50 p-4">
                  <div className="text-2xl font-extrabold tracking-[-0.03em] text-slate-900">{dashboard.stats.setCount}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Sets</div>
                </div>
                <div className="rounded-[16px] bg-slate-50 p-4">
                  <div className="text-2xl font-extrabold tracking-[-0.03em] text-slate-900">{formatVolume(dashboard.stats.totalVolumeKg)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Kg Lifted</div>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {logoutMutation.isError ? (
          <p className="mt-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Unable to log out. Please try again.
          </p>
        ) : null}
        {startSessionMutation.isError ? (
          <p className="mt-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Unable to start workout. Please try again.
          </p>
        ) : null}
      </div>
    </main>
  )
}
