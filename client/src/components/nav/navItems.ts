import type { LucideIcon } from 'lucide-react'
import {
  ChartNoAxesCombined,
  ClipboardList,
  History,
  House,
  UserRound,
} from 'lucide-react'

export type NavItem = {
  to: string
  mobileLabel: string
  desktopLabel: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', mobileLabel: 'Home', desktopLabel: 'Dashboard', icon: House },
  { to: '/history', mobileLabel: 'History', desktopLabel: 'History', icon: History },
  { to: '/progress', mobileLabel: 'Progress', desktopLabel: 'Progress', icon: ChartNoAxesCombined },
  { to: '/program', mobileLabel: 'Program', desktopLabel: 'Program', icon: ClipboardList },
  { to: '/profile', mobileLabel: 'Profile', desktopLabel: 'Profile', icon: UserRound },
]

export function getNavItemTarget(item: NavItem, activeProgramId?: string) {
  return item.to === '/program' && activeProgramId ? `/program/${activeProgramId}` : item.to
}

export function isNavItemActive(item: NavItem, pathname: string) {
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
