import { useQuery } from '@tanstack/react-query'
import { Link, NavLink } from 'react-router-dom'
import { dashboardQueryKey, getDashboard } from '../../lib/dashboard'
import { formatWorkoutDuration, useWorkoutTimer } from '../../lib/useWorkoutTimer'
import { NAV_ITEMS } from './navItems'

function ActiveWorkoutTimer({ sessionId, startedAt }: { sessionId: string; startedAt: string }) {
  const elapsedSeconds = useWorkoutTimer(startedAt)
  const duration = formatWorkoutDuration(elapsedSeconds)

  return (
    <Link
      to={`/workout/${sessionId}?from=navigation`}
      aria-label={`Resume active workout, ${duration} elapsed`}
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex min-h-11 min-w-[76px] items-center justify-center rounded-full border border-white/10 bg-slate-900 px-3.5 py-2 text-[17px] font-black tracking-[-0.03em] tabular-nums text-white shadow-[0_8px_20px_rgba(15,23,42,0.22),0_2px_5px_rgba(15,23,42,0.12)] transition hover:bg-slate-800 active:scale-[0.97] lg:hidden"
    >
      {duration}
    </Link>
  )
}

export function BottomTabBar() {
  const { data: dashboard } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: getDashboard,
    retry: false,
  })

  return (
    <>
      {dashboard?.activeSession ? (
        <ActiveWorkoutTimer
          sessionId={dashboard.activeSession.id}
          startedAt={dashboard.activeSession.startedAt}
        />
      ) : null}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-slate-200 bg-white px-3 pt-2 lg:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-none px-1 py-1.5 text-[11px] font-extrabold leading-none ${
                  isActive
                    ? 'text-slate-900 before:absolute before:-top-2 before:left-1/2 before:h-[3px] before:w-6 before:-translate-x-1/2 before:rounded-full before:bg-slate-900 before:content-[\'\']'
                    : 'text-slate-500'
                }`
              }
            >
              <span className="flex h-6 w-7 items-center justify-center" aria-hidden="true">
                <Icon size={18} strokeWidth={1.9} />
              </span>
              {item.mobileLabel}
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}
