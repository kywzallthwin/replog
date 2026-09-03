import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { dashboardQueryKey, getDashboard } from '../../lib/dashboard'
import { getNavItemTarget, isNavItemActive, NAV_ITEMS } from './navItems'

export function TopNav() {
  const location = useLocation()
  const { data: dashboard } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: getDashboard,
    retry: false,
  })

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1.5 lg:flex">
      {NAV_ITEMS.map((item) => {
        const isActive = isNavItemActive(item, location.pathname)

        return (
          <Link
            key={item.to}
            to={getNavItemTarget(item, dashboard?.activeProgram?.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-11 items-center rounded-[10px] px-3.5 py-2 text-[13px] font-bold no-underline ${
              isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500'
            }`}
          >
            {item.desktopLabel}
          </Link>
        )
      })}
    </nav>
  )
}
