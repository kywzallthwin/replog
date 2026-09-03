import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardQueryKey, getDashboard } from '../lib/dashboard'
import { authMeQueryKey, clearPrivateQueries, getCurrentUser, logoutUser } from '../lib/auth'
import { startSession } from '../lib/sessions'
import { getBadgeClass } from '../lib/badgeColors'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'
import { BrandLogo } from '../components/BrandLogo'
import { PageLoader } from '../components/ui/PageLoader'

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

function formatDuration(durationSec: number | null, endedAt: string | null) {
  if (!endedAt) {
    return 'In progress'
  }

  return durationSec === null
    ? 'Finished · Duration unavailable'
    : `Finished · Duration: ${Math.max(1, Math.round(durationSec / 60))} min`
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
      clearPrivateQueries(queryClient)
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
    onError: (error) => {
      if (axios.isAxiosError<{ activeSessionId?: string }>(error)) {
        const activeSessionId = error.response?.data?.activeSessionId

        if (activeSessionId) {
          navigate(`/workout/${activeSessionId}?from=dashboard`)
        }
      }
    },
  })
  const usableProgramDays = dashboard?.activeProgram?.days.filter((day) => day.exerciseCount > 0) ?? []

  return (
    <main className="min-h-dvh bg-slate-100 px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <BrandLogo className="h-6 w-auto" />
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">
              Dashboard
            </h1>
          </div>
          <TopNav />
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className="flex min-h-11 items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition hover:bg-slate-50"
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
              className="min-h-11 rounded-[13px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
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
          <PageLoader statusMessage="Loading dashboard..." />
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
              {dashboard.activeSession ? (
                <section className="mb-5 rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(15,23,42,0.12)]">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Workout in progress{dashboard.activeSession.programName ? ` · ${dashboard.activeSession.programName}` : ''}
                  </p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] ${getBadgeClass(dashboard.activeSession.badgeColor)}`}>
                    {dashboard.activeSession.dayName}
                  </span>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                    {dashboard.activeSession.dayName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Started {formatSessionDate(dashboard.activeSession.startedAt)} · {dashboard.activeSession.exerciseCount} exercises
                  </p>
                  <Link
                    to={`/workout/${dashboard.activeSession.id}?from=dashboard`}
                    className="mt-5 block w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-center text-[15px] font-semibold text-white"
                  >
                    Resume Workout
                  </Link>
                </section>
              ) : null}
              <section className={`mb-5 rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)] ${dashboard.activeSession ? 'hidden' : ''}`}>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Up Next{dashboard.activeProgram ? ' · ' : ''}
                  {dashboard.activeProgram ? (
                    <Link to={`/program/${dashboard.activeProgram.id}`} className="transition hover:text-slate-600">
                      {dashboard.activeProgram.name}
                    </Link>
                  ) : null}
                </p>
                {dashboard.suggestedDay ? (
                  <>
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] ${getBadgeClass(dashboard.suggestedDay.badgeColor)}`}>
                      {dashboard.suggestedDay.name}
                    </span>
                    <p className="mt-1 text-sm text-slate-500">
                      {dashboard.suggestedDay.exerciseCount} exercises
                      {dashboard.suggestedDay.categories.length
                        ? ` · ${dashboard.suggestedDay.categories.join(' + ')}`
                        : ''}
                    </p>
                    <button
                      type="button"
                      disabled={Boolean(dashboard.activeSession) || startSessionMutation.isPending}
                      onClick={() => {
                        if (dashboard.suggestedDay) {
                          startSessionMutation.mutate(dashboard.suggestedDay.id)
                        }
                      }}
                      className="mt-5 w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800"
                    >
                      {dashboard.activeSession
                        ? 'Finish or cancel your active workout first'
                        : startSessionMutation.isPending
                          ? 'Starting...'
                          : 'Start Workout'}
                    </button>
                  </>
                ) : dashboard.activeProgram ? (
                  <Link
                    to={`/program/${dashboard.activeProgram.id}`}
                    className="mt-3 inline-flex min-h-11 items-center rounded-[13px] bg-slate-900 px-5 text-[15px] font-semibold text-white transition hover:bg-slate-800"
                  >
                    Edit Program
                  </Link>
                ) : (
                  <Link
                    to="/program"
                    className="mt-3 inline-flex min-h-11 items-center rounded-[13px] bg-slate-900 px-5 text-[15px] font-semibold text-white transition hover:bg-slate-800"
                  >
                    Browse Programs
                  </Link>
                )}
              </section>

              {dashboard.activeSession || usableProgramDays.length ? (
                <section className="mb-5">
                  {dashboard.activeSession ? (
                    <div className="mb-4 flex items-start gap-3 rounded-[16px] border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-200 text-[11px] font-black text-slate-600" aria-hidden="true">
                        i
                      </span>
                      <p>Finish or cancel this workout before starting another.</p>
                    </div>
                  ) : null}
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-500">
                      {dashboard.activeSession ? 'Other workouts' : 'Or pick a day:'}
                    </p>
                    {dashboard.activeSession ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Locked</span>
                    ) : null}
                  </div>
                  <div className={`flex flex-wrap gap-2 ${dashboard.activeSession ? 'opacity-50' : ''}`}>
                    {usableProgramDays.map((day) => (
                      <button
                        type="button"
                        key={day.id}
                        disabled={Boolean(dashboard.activeSession) || startSessionMutation.isPending}
                        onClick={() => startSessionMutation.mutate(day.id)}
                        className={`min-h-11 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.04em] shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-black/5 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 ${getBadgeClass(day.badgeColor)}`}
                      >
                        {day.name}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-slate-400">Recent Sessions</h3>
                  <Link to="/history" className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold text-slate-900 transition hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200">
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {dashboard.recentSessions.length ? (
                    dashboard.recentSessions.map((session) => (
                      <Link
                        key={session.id}
                        to={`/workout/${session.id}?from=dashboard`}
                        className="flex items-center justify-between rounded-[16px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">
                            {formatSessionDate(session.startedAt)}{' '}
                           <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${getBadgeClass(session.badgeColor)}`}>
                              {session.dayName}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {session.programName ? `${session.programName} · ` : ''}{session.exerciseCount} exercises · {formatDuration(session.durationSec, session.endedAt)}
                          </p>
                        </div>
                        <span className="text-lg text-slate-300">{String.fromCharCode(0x203a)}</span>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-[16px] bg-white p-4 text-sm text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                      No sessions logged yet. Finished workouts will appear here.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="rounded-[24px] bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)] lg:self-start">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[13px] font-bold text-slate-900">Your Stats</p>
                <Link to="/progress" className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold text-slate-900 transition hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200">
                  Progress
                </Link>
              </div>
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
      <BottomTabBar />
    </main>
  )
}
