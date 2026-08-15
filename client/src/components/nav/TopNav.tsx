import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'

export function TopNav() {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1.5 lg:flex">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex min-h-11 items-center rounded-[10px] px-3.5 py-2 text-[13px] font-bold no-underline ${
              isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500'
            }`
          }
        >
          {item.desktopLabel}
        </NavLink>
      ))}
    </nav>
  )
}
