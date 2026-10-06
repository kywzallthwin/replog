export type ManualMetadata = {
  workoutDate: string
  durationMinutes: string
  notes: string
}

export type ManualMetadataOverrides = Record<string, Partial<ManualMetadata>>

export function sessionManualMetadata(session: {
  id: string
  workoutDate?: string | null
  durationSec?: number | null
  notes?: string | null
}, overrides: ManualMetadataOverrides): ManualMetadata {
  const saved: ManualMetadata = {
    workoutDate: session.workoutDate?.slice(0, 10) ?? '',
    durationMinutes: session.durationSec == null ? '' : String(Math.round(session.durationSec / 60)),
    notes: session.notes ?? '',
  }
  return { ...saved, ...overrides[session.id] }
}

export function clearSavedManualMetadata(
  overrides: ManualMetadataOverrides,
  sessionId: string,
  submitted: Partial<ManualMetadata>,
): ManualMetadataOverrides {
  const current = overrides[sessionId]
  if (!current) return overrides
  const next = { ...current }
  for (const key of Object.keys(submitted) as Array<keyof ManualMetadata>) {
    if (Object.hasOwn(submitted, key) && current[key] === submitted[key]) delete next[key]
  }
  if (Object.keys(next).length === Object.keys(current).length) return overrides
  const result = { ...overrides }
  if (Object.keys(next).length) result[sessionId] = next
  else delete result[sessionId]
  return result
}
