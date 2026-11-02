import { describe, expect, it } from 'vitest'
import {
  computeExerciseRangeStats,
  niceTicks,
  resolveRightLabelsCollision,
  buildSparklineGeometry,
} from '../components/progress/progressCompareGeometry'
import type { ProgressExerciseSummary } from '../lib/progress'

function createSummary(id: string, sessions: { t: number, v: number }[]): ProgressExerciseSummary {
  return {
    exercise: { id, name: `Ex ${id}`, category: 'Cat' },
    personalBest: null,
    stats: { sessionCount: sessions.length, progressKg: 0, heaviestWeightKg: 0 },
    trendEstimatedOneRepMaxKg: [],
    sessionHistory: sessions.map((s, i) => ({
      sessionId: `s${i}`,
      startedAt: new Date(s.t).toISOString(),
      workoutDate: new Date(s.t).toISOString(),
      dayName: 'Day',
      volumeKg: s.v,
      topSet: { estimatedOneRepMaxKg: s.v, weightKg: s.v, reps: 1 }
    }))
  }
}

describe('Compare Chart Engine Math', () => {
  it('niceTicks generates sensible steps', () => {
    expect(niceTicks(0, 100)).toEqual([0, 25, 50, 75, 100])
    expect(niceTicks(-10, 10)).toEqual([-10, -5, 0, 5, 10])
    expect(niceTicks(-2, 2)).toEqual([-2, -1, 0, 1, 2])
  })

  it('resolveRightLabelsCollision prevents overlap by shifting labels', () => {
    const labels = [
      { id: '1', y: 10, text: 'A' },
      { id: '2', y: 20, text: 'B' }, // Overlaps with A if diff < 15
    ]
    resolveRightLabelsCollision(labels, 100, 10)
    expect(labels[0].y).toBe(10)
    expect(labels[1].y).toBe(25) // Shifted down to be 15px away

    const labels2 = [
      { id: '1', y: 90, text: 'A' },
      { id: '2', y: 95, text: 'B' },
    ]
    resolveRightLabelsCollision(labels2, 100, 5) // maxY = 95
    // After shift: diff must be 15. L0=90, L1=105. 
    // Max is 95, shift up by 10.
    // L0 becomes 80, L1 becomes 95.
    expect(labels2[0].y).toBe(80)
    expect(labels2[1].y).toBe(95)
  })

  it('computeExerciseRangeStats filters 2+ sessions and computes baseline % change', () => {
    const t0 = Date.now()
    const summaries = [
      createSummary('1', [
        { t: t0 - 20 * 86_400_000, v: 100 }, // in 30d
        { t: t0 - 10 * 86_400_000, v: 110 }, // in 30d
        { t: t0, v: 126 } // in 30d
      ]),
      createSummary('2', [
        { t: t0 - 10 * 86_400_000, v: 50 } // only 1 in 30d
      ])
    ]

    const stats = computeExerciseRangeStats(summaries, 30, 'e')
    expect(stats.length).toBe(1)
    
    const s = stats[0]
    expect(s.exerciseId).toBe('1')
    expect(s.base).toBe((100 + 110) / 2) // 105
    expect(s.cur).toBe(126)
    expect(s.pct).toBe(126 / 105 - 1) // 0.2
    expect(s.dir).toBe('up')
    expect(s.pts.length).toBe(3)
  })

  it('buildSparklineGeometry computes correct path and endpoints', () => {
    const pts = [{ pct: 0 }, { pct: 0.1 }, { pct: 0.2 }]
    const geo = buildSparklineGeometry(pts, 64)
    expect(geo).not.toBeNull()
    expect(geo?.path).toContain('M0,')
    expect(geo?.path).toContain('L32,')
    expect(geo?.path).toContain('L64,')
    expect(geo?.circle.cx).toBe(64)
    // End value is highest (0.2), so y should be the minimum possible (top of SVG with pad)
    expect(geo?.circle.cy).toBe(3) 
  })
})
