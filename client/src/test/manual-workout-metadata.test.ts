import { describe, expect, it } from 'vitest'
import { clearSavedManualMetadata, sessionManualMetadata, type ManualMetadataOverrides } from '../lib/manual-workout-metadata'

const session = (id: string, values: { workoutDate?: string; durationSec?: number | null; notes?: string | null } = {}) => ({
  id,
  workoutDate: values.workoutDate ?? '2026-10-01',
  durationSec: values.durationSec ?? null,
  notes: values.notes ?? 'Saved note',
})

describe('manual workout metadata overrides', () => {
  it('derives untouched fields from fetched session data', () => {
    expect(sessionManualMetadata(session('one', { durationSec: 1800 }), {})).toEqual({
      workoutDate: '2026-10-01', durationMinutes: '30', notes: 'Saved note',
    })
  })

  it('switches metadata with the session key', () => {
    const overrides: ManualMetadataOverrides = { one: { notes: 'Draft edit' } }
    expect(sessionManualMetadata(session('two', { notes: 'Other session' }), overrides).notes).toBe('Other session')
    expect(sessionManualMetadata(session('one'), overrides).notes).toBe('Draft edit')
  })

  it('preserves edited fields across refetches while deriving untouched updates', () => {
    const overrides: ManualMetadataOverrides = { one: { notes: 'Unsaved edit' } }
    expect(sessionManualMetadata(session('one', { workoutDate: '2026-10-02', notes: 'Old server note' }), overrides)).toEqual({
      workoutDate: '2026-10-02', durationMinutes: '', notes: 'Unsaved edit',
    })
  })

  it('clears a saved override only when it still equals the submitted value', () => {
    const before: ManualMetadataOverrides = { one: { notes: 'Submitted', workoutDate: '2026-10-02' } }
    const afterEditDuringSave = { one: { notes: 'Newer edit', workoutDate: '2026-10-02' } }
    expect(clearSavedManualMetadata(afterEditDuringSave, 'one', { notes: 'Submitted', workoutDate: '2026-10-02' })).toEqual({
      one: { notes: 'Newer edit' },
    })
    expect(clearSavedManualMetadata(before, 'one', { notes: 'Submitted' })).toEqual({
      one: { workoutDate: '2026-10-02' },
    })
  })
})
