export function getBadgeClass(badgeColor: string) {
  if (badgeColor === 'bg-amber-100 text-amber-800') {
    return 'bg-amber-100 text-amber-800'
  }

  if (badgeColor === 'bg-blue-100 text-blue-800') {
    return 'bg-blue-100 text-blue-800'
  }

  if (badgeColor === 'bg-pink-100 text-pink-800') {
    return 'bg-pink-100 text-pink-800'
  }

  if (badgeColor === 'bg-indigo-100 text-indigo-800') {
    return 'bg-indigo-100 text-indigo-800'
  }

  if (badgeColor === 'bg-green-100 text-green-800') {
    return 'bg-green-100 text-green-800'
  }

  if (badgeColor === 'bg-purple-100 text-purple-800') {
    return 'bg-purple-100 text-purple-800'
  }

  if (badgeColor === 'bg-rose-100 text-rose-800') {
    return 'bg-rose-100 text-rose-800'
  }

  if (badgeColor === 'bg-teal-100 text-teal-800') {
    return 'bg-teal-100 text-teal-800'
  }

  return 'bg-slate-100 text-slate-600'
}
