import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'

export function BottomTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-slate-100 bg-white px-2 pt-2 shadow-[0_-1px_3px_rgba(15,23,42,0.08)] lg:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 py-2 text-[11px] font-extrabold ${
              isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500'
            }`
          }
        >
          <span className="text-[15px] leading-none" aria-hidden="true">
            {item.glyph}
          </span>
          {item.mobileLabel}
        </NavLink>
      ))}
    </nav>
  )
}
