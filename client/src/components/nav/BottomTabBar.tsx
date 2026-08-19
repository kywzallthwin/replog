import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'

export function BottomTabBar() {
  return (
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
  )
}
