export type ParsedSetNotation = {
  kind: 'NORMAL' | 'DROP'
  weightKg: number
  reps: number
}

const setPattern = /(\d+(?:\.\d+)?)\s*k\s*(\d+)\s*r/gi

export function parseSetNotation(value: string, parentSetId?: string): ParsedSetNotation[] {
  const sets: ParsedSetNotation[] = []
  let previousEnd = 0
  let match: RegExpExecArray | null

  setPattern.lastIndex = 0

  while ((match = setPattern.exec(value)) !== null) {
    const separator = value.slice(previousEnd, match.index)

    if ((sets.length === 0 && separator.trim()) || (sets.length > 0 && separator.trim() && !separator.includes('>'))) {
      return []
    }

    const isDrop = Boolean(parentSetId) || (sets.length > 0 && (separator.includes('>') || separator.length === 0))

    sets.push({
      kind: isDrop ? 'DROP' : 'NORMAL',
      weightKg: Number(match[1]),
      reps: Number(match[2]),
    })
    previousEnd = setPattern.lastIndex
  }

  if (value.slice(previousEnd).trim()) {
    return []
  }

  return sets
}

export function hasValidSetNotation(value: string, parentSetId?: string) {
  const sets = parseSetNotation(value, parentSetId)

  if (!sets.length) {
    return false
  }

  if (parentSetId) {
    return sets.every((set) => set.kind === 'DROP')
  }

  return sets[0].kind === 'NORMAL' && sets.slice(1).every((set) => set.kind === 'DROP')
}
