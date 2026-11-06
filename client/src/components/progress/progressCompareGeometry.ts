import { formatEstimatedOneRepMax, formatVolumeSummary, type WeightUnit } from '../../lib/units'
import type { ProgressExerciseSummary } from '../../lib/progress'

export const MAX_COMPARE_SLOTS = 5
export const SLOT_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const
export const RANGE_OPTIONS = [30, 90, 180, 365] as const
export const METRIC_OPTIONS = ['e', 'v'] as const

export type CompareRange = typeof RANGE_OPTIONS[number]
export type CompareMetric = typeof METRIC_OPTIONS[number]

export type ExerciseRangeStats = {
  exerciseId: string
  name: string
  category: string
  pts: { sessionId: string; t: number; v: number; pct: number }[]
  base: number
  cur: number
  pct: number
  n: number
  last: number
  dir: 'up' | 'down' | 'flat'
}

function resolveSessionTime(session: { startedAt: string; workoutDate?: string | null }): number {
  return session.workoutDate
    ? new Date(`${session.workoutDate.slice(0, 10)}T12:00:00`).getTime()
    : new Date(session.startedAt).getTime()
}

export function computeExerciseRangeStats(
  summaries: ProgressExerciseSummary[],
  rangeDays: CompareRange,
  metric: CompareMetric
): ExerciseRangeStats[] {
  if (!summaries.length) return []

  let anchorTime = 0
  for (const summary of summaries) {
    for (const session of summary.sessionHistory) {
      const t = resolveSessionTime(session)
      if (t > anchorTime) anchorTime = t
    }
  }
  
  if (Date.now() > anchorTime) {
    anchorTime = Date.now()
  }

  const cut = anchorTime - rangeDays * 86_400_000
  const stats: ExerciseRangeStats[] = []

  for (const summary of summaries) {
    const sessions = [...summary.sessionHistory]
      .map(session => ({
        sessionId: session.sessionId,
        t: resolveSessionTime(session),
        v: metric === 'e' 
          ? session.topSet.estimatedOneRepMaxKg 
          : (session.volumeKg ?? session.topSet.weightKg * session.topSet.reps)
      }))
      .sort((a, b) => a.t - b.t)
      .filter(s => s.t >= cut)

    if (sessions.length < 2) continue

    const base = (sessions[0].v + sessions[1].v) / 2

    const pts = sessions.map(s => ({
      ...s,
      pct: base > 0 ? s.v / base - 1 : 0
    }))

    const lastPt = pts[pts.length - 1]
    const pct = lastPt.pct

    stats.push({
      exerciseId: summary.exercise.id,
      name: summary.exercise.name,
      category: summary.exercise.category,
      pts,
      base,
      cur: lastPt.v,
      pct,
      n: pts.length,
      last: lastPt.t,
      dir: pct > 0.01 ? 'up' : pct < -0.01 ? 'down' : 'flat'
    })
  }

  return stats
}

export function formatPercentChange(pct: number, decimals = 1): string {
  const x = pct * 100
  const s = Math.abs(x).toFixed(decimals)
  if (x > 0.04) return `+${s}%`
  if (x < -0.04) return `\u2212${s}%`
  return `${s}%`
}

export function formatMetricWeight(valueKg: number, metric: CompareMetric, weightUnit: WeightUnit): string {
  if (metric === 'e') {
    return formatEstimatedOneRepMax(valueKg, weightUnit)
  }
  return formatVolumeSummary(valueKg, weightUnit)
}

export function niceTicks(lo: number, hi: number): number[] {
  const span = Math.max(hi - lo, 2)
  const steps = [1, 2, 5, 10, 20, 25, 50, 100]
  let step = 200
  for (const s of steps) {
    if (span / s <= 4) {
      step = s
      break
    }
  }
  
  const minTick = Math.floor(lo / step) * step
  const maxTick = Math.ceil(hi / step) * step
  
  const ticks = []
  for (let t = minTick; t <= maxTick; t += step) {
    ticks.push(t)
  }
  return ticks
}

export function xTicks(tMin: number, tMax: number, rangeDays: CompareRange): { t: number, label: string }[] {
  const ticks: { t: number, label: string }[] = []
  
  if (rangeDays === 30) {
    // Weekly ticks
    const end = new Date(tMax)
    end.setHours(12, 0, 0, 0)
    for (let d = new Date(end); d.getTime() >= tMin; d.setDate(d.getDate() - 7)) {
      ticks.unshift({
        t: d.getTime(),
        label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(d)
      })
    }
  } else {
    // Monthly or quarterly ticks
    const start = new Date(tMin)
    start.setDate(1)
    start.setHours(12, 0, 0, 0)
    
    for (let d = new Date(start); d.getTime() <= tMax; d.setMonth(d.getMonth() + 1)) {
      if (d.getTime() < tMin) continue
      
      if (rangeDays === 365 && d.getMonth() % 3 !== 0) continue
      
      ticks.push({
        t: d.getTime(),
        label: new Intl.DateTimeFormat('en', { month: 'short' }).format(d)
      })
    }
  }
  
  return ticks
}

export function resolveRightLabelsCollision(labels: { id: string, y: number, text: string }[], height: number, marginBottom: number) {
  labels.sort((a, b) => a.y - b.y)
  
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 15) {
      labels[i].y = labels[i - 1].y + 15
    }
  }
  
  const maxY = height - marginBottom
  if (labels.length > 0 && labels[labels.length - 1].y > maxY) {
    const shift = labels[labels.length - 1].y - maxY
    for (let i = 0; i < labels.length; i++) {
      labels[i].y -= shift
    }
  }
}

export function buildSparklineGeometry(pts: { pct: number }[], width: number = 64): { path: string, circle: { cx: number, cy: number, r: number } } | null {
  if (pts.length < 2) return null
  
  const h = 28
  const pad = 3
  
  let min = pts[0].pct
  let max = pts[0].pct
  for (const pt of pts) {
    if (pt.pct < min) min = pt.pct
    if (pt.pct > max) max = pt.pct
  }
  
  if (max - min < 0.004) {
    min -= 0.002
    max += 0.002
  }
  
  const w = width
  
  const coords = pts.map((pt, i) => {
    const x = (i / (pts.length - 1)) * w
    const y = h - pad - ((pt.pct - min) / (max - min)) * (h - 2 * pad)
    return { x, y }
  })
  
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
  const last = coords[coords.length - 1]
  
  return {
    path,
    circle: { cx: last.x, cy: last.y, r: 2.6 }
  }
}
