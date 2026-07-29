export type NavItem = {
  to: string
  mobileLabel: string
  desktopLabel: string
  glyph: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', mobileLabel: 'Home', desktopLabel: 'Dashboard', glyph: '■' },
  { to: '/history', mobileLabel: 'History', desktopLabel: 'History', glyph: '≡' },
  { to: '/progress', mobileLabel: 'Progress', desktopLabel: 'Progress', glyph: '▲' },
  { to: '/program', mobileLabel: 'Program', desktopLabel: 'Program', glyph: '◎' },
  { to: '/profile', mobileLabel: 'Profile', desktopLabel: 'Profile', glyph: '●' },
]
