import { useState, useMemo, Fragment, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'

function usePressRepeat(action: () => void) {
  const timeoutRef = useRef<number>()
  const intervalRef = useRef<number>()
  const actionRef = useRef(action)
  actionRef.current = action

  const stop = useCallback(() => {
    window.clearTimeout(timeoutRef.current)
    window.clearInterval(intervalRef.current)
  }, [])

  const start = useCallback((e: React.PointerEvent) => {
    e.preventDefault() // prevent double firing on touch
    actionRef.current()
    stop()
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        actionRef.current()
      }, 100) // repeat every 100ms
    }, 400) // start repeating after 400ms
  }, [stop])

  useEffect(() => stop, [stop])

  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop }
}

import { Link, useSearchParams } from 'react-router-dom'
import { getProgress, normalizeProgressData, progressQueryKey } from '../lib/progress'
import { useWeightUnit } from '../lib/units'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { BrandLogo } from '../components/BrandLogo'
import { PageLoader } from '../components/ui/PageLoader'
import { Dialog } from '../components/ui/Dialog'
import {
  computeExerciseRangeStats,
  formatPercentChange,
  formatMetricWeight,
  niceTicks,
  xTicks,
  resolveRightLabelsCollision,
  buildSparklineGeometry,
  MAX_COMPARE_SLOTS,
  SLOT_COLORS,
  RANGE_OPTIONS,
  METRIC_OPTIONS,
  type CompareRange,
  type CompareMetric,
  type ExerciseRangeStats
} from '../components/progress/progressCompareGeometry'

const XSvg = () => (
  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="h-2.5 w-2.5">
    <path d="M2 2l6 6M8 2L2 8"/>
  </svg>
)

type SortOption = 'gain' | 'trained' | 'stalled' | 'az'

export function ProgressPage() {
  const [searchParams] = useSearchParams()
  const initialSlotsParam = searchParams.get('slots')
  const weightUnit = useWeightUnit()
  const { data: progress, isError, isPending } = useQuery({
    queryKey: progressQueryKey(null),
    queryFn: () => getProgress(null),
    retry: false,
  })

  const hasCachedProgress = progress !== undefined
  const isInitialError = isError && !hasCachedProgress
  const isRefreshError = isError && hasCachedProgress
  const normalizedProgress = progress ? normalizeProgressData(progress) : undefined
  const summaries = useMemo(() => normalizedProgress?.exerciseSummaries ?? [], [normalizedProgress])

  const [rangeDays, setRangeDays] = useState<CompareRange>(90)
  const [metric, setMetric] = useState<CompareMetric>('e')
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('gain')
  const [muscleFilter, setMuscleFilter] = useState('All')

  const [slots, setSlots] = useState<(string | null)[]>(Array(MAX_COMPARE_SLOTS).fill(null))
  const [showFullHint, setShowFullHint] = useState(false)
  const [prevStatsLength, setPrevStatsLength] = useState(0)

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [calcW, setCalcW] = useState(() => weightUnit === 'LB' ? 225 : 100)
  const [calcR, setCalcR] = useState(5)
  const sheetTriggerRef = useRef<HTMLButtonElement>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const wMinus = usePressRepeat(() => setCalcW(w => Math.max(weightUnit === 'LB' ? 5 : 2.5, w - (weightUnit === 'LB' ? 5 : 2.5))))
  const wPlus = usePressRepeat(() => setCalcW(w => Math.min(400, w + (weightUnit === 'LB' ? 5 : 2.5))))
  const rMinus = usePressRepeat(() => setCalcR(r => Math.max(1, r - 1)))
  const rPlus = usePressRepeat(() => setCalcR(r => Math.min(20, r + 1)))

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const stats = useMemo(() => computeExerciseRangeStats(summaries, rangeDays, metric), [summaries, rangeDays, metric])

  if (prevStatsLength === 0 && stats.length > 0) {
    setPrevStatsLength(stats.length)
    const newSlots = Array(MAX_COMPARE_SLOTS).fill(null)

    if (initialSlotsParam) {
      const parsedSlots = initialSlotsParam.split(',').filter(Boolean).slice(0, MAX_COMPARE_SLOTS)
      for (let i = 0; i < parsedSlots.length; i++) {
        newSlots[i] = parsedSlots[i]
      }
    } else {
      const top = [...stats].sort((a, b) => b.n - a.n).slice(0, 3)
      for (let i = 0; i < top.length; i++) {
        newSlots[i] = top[i].exerciseId
      }
    }
    setSlots(newSlots)
  }

  const categories = useMemo(() => {
    const cats = new Set(stats.map(s => s.category))
    cats.delete('All')
    return ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms'].filter(c => c === 'All' || cats.has(c)).concat(
      Array.from(cats).filter(c => !['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'].includes(c)).sort()
    )
  }, [stats])

  const filteredStats = useMemo(() => {
    let result = stats
    if (muscleFilter !== 'All') {
      result = result.filter(s => s.category === muscleFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s => s.name.toLowerCase().includes(q))
    }
    return result.sort((a, b) => {
      if (sort === 'gain') return b.pct - a.pct
      if (sort === 'trained') return b.n - a.n
      if (sort === 'stalled') return Math.abs(a.pct) - Math.abs(b.pct)
      return a.name.localeCompare(b.name)
    })
  }, [stats, search, sort, muscleFilter])

  const toggleSlot = (id: string) => {
    const idx = slots.indexOf(id)
    if (idx >= 0) {
      const newSlots = [...slots]
      newSlots[idx] = null
      setSlots(newSlots)
      setShowFullHint(false)
      return
    }
    const emptyIdx = slots.indexOf(null)
    if (emptyIdx >= 0) {
      const newSlots = [...slots]
      newSlots[emptyIdx] = id
      setSlots(newSlots)
      setShowFullHint(false)
    } else {
      setShowFullHint(true)
    }
  }

  const selectedStats = slots.map(id => stats.find(s => s.exerciseId === id) ?? null)
  const activeCount = slots.filter(Boolean).length

  const [activeT, setActiveT] = useState<number | null>(null)

  const chartData = useMemo(() => {
    if (activeCount === 0) return null
    const valid = selectedStats.map((s, i) => s ? { s, color: SLOT_COLORS[i] } : null).filter(Boolean) as { s: ExerciseRangeStats, color: string }[]
    if (valid.length === 0) return null

    let tMin = Infinity
    let tMax = -Infinity
    let pMin = 0
    let pMax = 0

    for (const { s } of valid) {
      for (const pt of s.pts) {
        if (pt.t < tMin) tMin = pt.t
        if (pt.t > tMax) tMax = pt.t
        if (pt.pct < pMin) pMin = pt.pct
        if (pt.pct > pMax) pMax = pt.pct
      }
    }

    if (tMin === Infinity) return null
    if (tMin === tMax) tMin -= 86400000 // padded

    pMin = Math.min(pMin, -0.05)
    pMax = Math.max(pMax, 0.05)

    const pad = Math.max((pMax - pMin) * 0.1, 0.05)
    pMin -= pad
    pMax += pad

    const yTicks = niceTicks(pMin * 100, pMax * 100).map(v => v / 100)
    pMin = Math.min(pMin, yTicks[0])
    pMax = Math.max(pMax, yTicks[yTicks.length - 1])

    const xTicksList = xTicks(tMin, tMax, rangeDays)

    const W = Math.max(260, containerWidth || 720)
    const isNarrow = W < 480
    const H = isNarrow ? 232 : 280
    const m = { t: 12, r: isNarrow ? 98 : 118, b: 26, l: 40 }
    const w = W - m.l - m.r
    const h = H - m.t - m.b

    const getX = (t: number) => m.l + ((t - tMin) / (tMax - tMin)) * w
    const getY = (p: number) => m.t + h - ((p - pMin) / (pMax - pMin)) * h

    const lines = valid.map(({ s, color }) => {
      const coords = s.pts.map(pt => ({
        x: getX(pt.t),
        y: getY(pt.pct),
        pt
      }))
      const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      return { s, color, coords, path }
    })

    const rightLabels = lines.map(line => {
      const nameParts = line.s.name.split(' ')
      return {
        id: line.s.exerciseId,
        y: line.coords[line.coords.length - 1].y,
        text: `${nameParts[0]} ${formatPercentChange(line.coords[line.coords.length - 1].pt.pct)}`,
        fullName: line.s.name,
        color: line.color
      }
    })

    resolveRightLabelsCollision(rightLabels, H, m.b)

    return { W, H, m, w, h, getX, getY, tMin, tMax, pMin, pMax, yTicks, xTicks: xTicksList, lines, rightLabels }
  }, [selectedStats, activeCount, rangeDays, containerWidth])

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!chartData || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(chartData.m.l, Math.min(chartData.W - chartData.m.r, e.clientX - rect.left))
    const t = chartData.tMin + ((x - chartData.m.l) / chartData.w) * (chartData.tMax - chartData.tMin)
    setActiveT(t)
  }

  const getDeltaIcon = (dir: 'up' | 'down' | 'flat') => {
    if (dir === 'up') return <svg viewBox="0 0 10 10" aria-hidden="true" className="h-[9px] w-[9px] flex-none fill-current"><path d="M5 1.5l4 6H1z"/></svg>
    if (dir === 'down') return <svg viewBox="0 0 10 10" aria-hidden="true" className="h-[9px] w-[9px] flex-none fill-current"><path d="M5 8.5l-4-6h8z"/></svg>
    return <svg viewBox="0 0 10 10" aria-hidden="true" className="h-[9px] w-[9px] flex-none fill-current"><rect x="1" y="4.1" width="8" height="1.8" rx="0.9"/></svg>
  }

  return (
    <main className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-slate-100 px-4 pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 lg:py-10">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
        <header className="flex flex-col gap-1">
          <div className="flex min-h-[32px] items-center justify-between gap-3">
            <Link to="/dashboard" aria-label="Back to dashboard" className="inline-flex items-center">
              <BrandLogo className="h-6 w-auto" />
            </Link>
          </div>
          <h1 className="m-0 text-[30px] font-bold leading-[1.15] tracking-[-0.03em] text-slate-900">Progress</h1>
        </header>

        {isPending ? <PageLoader statusMessage="Loading progress..." /> : null}

        {isInitialError ? (
          <div role="alert" className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Unable to load progress. Please refresh and try again.
          </div>
        ) : null}

        {isRefreshError ? (
          <div role="alert" className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Unable to refresh progress. Showing previously loaded values.
          </div>
        ) : null}

        {!isPending && !isInitialError && summaries.length === 0 ? (
          <div className="rounded-[24px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
            <h2 className="text-sm font-semibold text-slate-900">No finished sets yet.</h2>
            <p className="mt-1 text-sm text-slate-500">Complete a workout with normal working sets to see exercise progress here.</p>
          </div>
        ) : null}

        {!isPending && summaries.length > 0 ? (
          <>
            <div role="group" aria-label="Time range" className="flex gap-[2px] rounded-[14px] bg-slate-200 p-1">
              {RANGE_OPTIONS.map(val => (
                <button
                  key={val}
                  type="button"
                  aria-pressed={rangeDays === val}
                  onClick={() => setRangeDays(val)}
                  className={`min-h-[40px] flex-1 rounded-[10px] border-0 bg-transparent px-3 text-[14px] font-semibold transition-colors ${rangeDays === val ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)]' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {val === 30 ? '30d' : val === 90 ? '90d' : val === 180 ? '6m' : '1y'}
                </button>
              ))}
            </div>

            <section aria-label="Compare exercises" className="overflow-hidden rounded-[24px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
              <div className="flex flex-wrap items-center justify-between gap-[10px] px-[18px] pt-[18px]">
                <h2 className="m-0 text-[15px] font-bold text-slate-900">Compare<span className="ml-[6px] text-[13px] font-semibold text-slate-400">{activeCount} of 5</span></h2>
                <div role="group" aria-label="Metric" className="flex flex-none gap-[2px] rounded-[12px] bg-slate-200 p-[3px]">
                  {METRIC_OPTIONS.map(val => (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={metric === val}
                      onClick={() => setMetric(val)}
                      className={`flex-none rounded-[9px] px-[11px] min-h-[30px] text-[12px] font-semibold transition-colors ${metric === val ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)]' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
                    >
                      {val === 'e' ? 'Est. 1RM' : 'Volume'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-[12px] flex-wrap gap-[6px] px-[18px] pt-[12px]">
                {slots.map((id, idx) => {
                  if (!id) return null
                  const s = stats.find(x => x.exerciseId === id)
                  if (!s) return null
                  return (
                    <span key={id} className="inline-flex h-[30px] items-center gap-[7px] rounded-full bg-slate-100 pl-[10px] pr-[3px] text-[13px] font-semibold text-slate-900">
                      <i className="h-[9px] w-[9px] flex-none rounded-full" style={{ backgroundColor: SLOT_COLORS[idx] }} />
                      {s.name}
                      <button type="button" aria-label={`Remove ${s.name} from chart`} onClick={() => toggleSlot(id)} className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-900">
                        <XSvg />
                      </button>
                    </span>
                  )
                })}
              </div>

              <div aria-live="polite" className="px-[18px] pt-[8px] text-[12px] text-slate-600 empty:hidden">
                {showFullHint ? 'The chart holds up to 5. Remove one to add another.' : ''}
              </div>

              <div className="relative px-[6px] pt-[4px]" ref={containerRef}>
                {activeCount === 0 ? (
                  <div className="mx-auto max-w-[32ch] px-6 py-9 text-center text-slate-600 [text-wrap:balance]">
                    Pick up to 5 exercises from the list to compare them.
                  </div>
                ) : view === 'table' ? (
                  <div className="overflow-x-auto px-[18px] pb-1 pt-2">
                    <table className="w-full border-collapse text-left text-[13px] whitespace-nowrap">
                      <thead>
                        <tr>
                          <th className="border-b border-slate-100 py-[9px] pr-2 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">Exercise</th>
                          <th className="border-b border-slate-100 py-[9px] pl-[14px] text-right text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">Start</th>
                          <th className="border-b border-slate-100 py-[9px] pl-[14px] text-right text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">Now</th>
                          <th className="border-b border-slate-100 py-[9px] pl-[14px] text-right text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStats.filter(Boolean).map(s => {
                          const idx = slots.indexOf(s!.exerciseId)
                          return (
                            <tr key={s!.exerciseId}>
                              <td className="border-b border-slate-100 py-[9px] pr-2 text-slate-900">
                                <i className="mr-2 inline-block h-[9px] w-[9px] rounded-full" style={{ backgroundColor: SLOT_COLORS[idx] }} />
                                {s!.name}
                              </td>
                              <td className="border-b border-slate-100 py-[9px] pl-[14px] text-right tabular-nums text-slate-900">{formatMetricWeight(s!.base, metric, weightUnit)}</td>
                              <td className="border-b border-slate-100 py-[9px] pl-[14px] text-right tabular-nums text-slate-900">{formatMetricWeight(s!.cur, metric, weightUnit)}</td>
                              <td className="border-b border-slate-100 py-[9px] pl-[14px] text-right tabular-nums">
                                <span className={`inline-flex items-center gap-1 text-[12px] font-bold ${s!.pct > 0.01 ? 'text-green-700' : s!.pct < -0.01 ? 'text-red-700' : 'text-slate-600'}`}>
                                  {getDeltaIcon(s!.pct > 0.01 ? 'up' : s!.pct < -0.01 ? 'down' : 'flat')}
                                  {formatPercentChange(s!.pct)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <>
                    {chartData && (
                      <svg
                        className="block w-full touch-pan-y"
                        viewBox={`0 0 ${chartData.W} ${chartData.H}`}
                        role="img"
                        aria-label={`Line chart of percent change in ${metric === 'e' ? 'estimated 1RM' : 'volume'} for ${selectedStats.filter(Boolean).map(s => s!.name).join(', ')}`}
                        onPointerMove={handlePointerMove}
                        onPointerDown={handlePointerMove}
                        onPointerLeave={() => setActiveT(null)}
                        onPointerCancel={() => setActiveT(null)}
                      >
                        {chartData.yTicks.map(y => (
                          <g key={y}>
                            <line x1={chartData.m.l} x2={chartData.W - chartData.m.r} y1={chartData.getY(y).toFixed(1)} y2={chartData.getY(y).toFixed(1)} stroke={y === 0 ? '#cbd5e1' : '#f1f5f9'} strokeWidth={y === 0 ? 1.5 : 1} />
                            <text x={chartData.m.l - 8} y={chartData.getY(y).toFixed(1)} dy="0.32em" textAnchor="end" fontSize="11" fill={y === 0 ? '#475569' : '#94a3b8'} fontWeight={y === 0 ? '700' : 'normal'}>
                              {y === 0 ? '0%' : (y > 0 ? '+' : '−') + Math.abs(y * 100).toFixed(0) + '%'}
                            </text>
                          </g>
                        ))}
                        {chartData.xTicks.map(tick => (
                          <text key={tick.t} x={chartData.getX(tick.t).toFixed(1)} y={chartData.H - 7} textAnchor="middle" fontSize="11" fill="#94a3b8">
                            {tick.label}
                          </text>
                        ))}
                        {chartData.lines.map((line) => (
                          <Fragment key={line.s.exerciseId}>
                            <path d={line.path} fill="none" stroke={line.color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                            {line.coords.length <= 14 && line.coords.map((c, ci) => (
                              <circle key={ci} cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="3" fill={line.color} stroke="#ffffff" strokeWidth="1.5" />
                            ))}
                            <circle cx={line.coords[line.coords.length - 1].x.toFixed(1)} cy={line.coords[line.coords.length - 1].y.toFixed(1)} r="4.5" fill={line.color} stroke="#ffffff" strokeWidth="2" />
                          </Fragment>
                        ))}
                        {chartData.rightLabels.map(label => (
                          <text key={label.id} x={chartData.W - chartData.m.r + 12} y={label.y.toFixed(1)} dy="0.32em" fontSize="11.5" fill="#0f172a">
                            <tspan fontWeight="700">{label.text.split(' ')[0]}</tspan>
                            <tspan dx="5" fill="#475569" fontWeight="600">{label.text.split(' ').slice(1).join(' ')}</tspan>
                          </text>
                        ))}

                        {activeT !== null && (
                          <g className="hov">
                            <line x1={chartData.getX(activeT).toFixed(1)} x2={chartData.getX(activeT).toFixed(1)} y1={chartData.m.t} y2={chartData.H - chartData.m.b} stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                            {chartData.lines.map(line => {
                              const closest = line.coords.reduce((a, b) => Math.abs(b.pt.t - activeT) < Math.abs(a.pt.t - activeT) ? b : a)
                              if (Math.abs(closest.pt.t - activeT) > 86400000 * 7) return null
                              return <circle key={line.s.exerciseId} cx={closest.x.toFixed(1)} cy={closest.y.toFixed(1)} r="4.5" fill={line.color} stroke="#ffffff" strokeWidth="2" />
                            })}
                          </g>
                        )}
                      </svg>
                    )}

                    {activeT !== null && chartData && (
                      <div
                        className="absolute z-10 min-w-[150px] pointer-events-none rounded-xl bg-white px-2.5 py-2 text-[12px] shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
                        style={{
                          left: Math.max(4, chartData.getX(activeT) + 20 + 150 > chartData.W ? chartData.getX(activeT) - 8 - 150 : chartData.getX(activeT) + 20),
                          top: chartData.m.t + 6
                        }}
                      >
                        <div className="mb-[3px] font-semibold text-slate-600">{new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(activeT)}</div>
                        {chartData.lines.map(line => {
                          const closest = line.coords.reduce((a, b) => Math.abs(b.pt.t - activeT) < Math.abs(a.pt.t - activeT) ? b : a)
                          if (Math.abs(closest.pt.t - activeT) > 86400000 * 7) return null
                          return (
                            <div key={line.s.exerciseId} className="flex items-center gap-[6px] py-[1px]">
                              <i className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: line.color }} />
                              <span className="min-w-0 flex-1 truncate">{line.s.name}</span>
                              <b className="font-bold tabular-nums">{formatPercentChange(closest.pt.pct)}</b>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 px-3 pb-3.5 pt-1.5">
                <button type="button" ref={sheetTriggerRef} onClick={() => setIsSheetOpen(true)} className="inline-flex h-10 cursor-pointer select-none items-center gap-2 rounded-full bg-slate-100 pl-1.5 pr-3 text-[13px] font-semibold text-slate-900 transition hover:bg-slate-200 active:scale-95 active:bg-slate-300" aria-haspopup="dialog">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-900 text-white">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="h-[14px] w-[14px]">
                      <path d="M8 7.2v4.3"/><circle cx="8" cy="4.6" r="0.6" fill="currentColor"/>
                    </svg>
                  </span>
                  <span>{metric === 'e' ? 'How 1RM works' : 'How volume works'}</span>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3 w-3 text-slate-400">
                    <path d="M4.5 2.5L8 6l-3.5 3.5"/>
                  </svg>
                </button>
                <button type="button" aria-pressed={view === 'table'} onClick={() => setView(view === 'table' ? 'chart' : 'table')} className="inline-flex h-10 cursor-pointer select-none items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3.5 text-[13px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-150 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-900 active:scale-95 active:bg-slate-300">
                  {view === 'table' ? 'Chart' : 'Table'}
                </button>
              </div>
            </section>

            <section aria-label="All exercises" className="rounded-[24px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
              <div className="flex flex-col gap-2.5 px-3.5 pb-3 pt-3.5">
                <div className="flex gap-2">
                  <label htmlFor="q" className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-900">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" className="h-[15px] w-[15px] flex-none text-slate-400">
                      <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
                    </svg>
                    <input id="q" type="search" placeholder="Search exercises" autoComplete="off" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent py-[11px] outline-none" />
                  </label>
                  <select id="sort" aria-label="Sort exercises" value={sort} onChange={e => setSort(e.target.value as SortOption)} className="max-w-[128px] rounded-xl border-0 bg-slate-100 px-2.5 text-[13px] font-semibold outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
                    <option value="gain">Best gain</option>
                    <option value="trained">Most trained</option>
                    <option value="stalled">Stalled</option>
                    <option value="az">A to Z</option>
                  </select>
                </div>
                <div className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Muscle group">
                  {categories.map(cat => (
                     <button
                       key={cat}
                       type="button"
                       aria-pressed={muscleFilter === cat}
                       onClick={() => setMuscleFilter(cat)}
                       className={`h-8 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ${muscleFilter === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                     >
                       {cat}
                     </button>
                  ))}
                </div>
              </div>

              <ul className="m-0 pb-2 pl-0 pr-0 list-none">
                {filteredStats.length === 0 ? (
                  <li className="px-4 py-7 text-center text-[14px] text-slate-600">No exercises match.</li>
                ) : filteredStats.map(s => {
                  const idx = slots.indexOf(s.exerciseId)
                  const isSelected = idx >= 0
                  const geo = buildSparklineGeometry(s.pts)
                  const d = s.pct > 0.01 ? 'up' : s.pct < -0.01 ? 'down' : 'flat'
                  const strokeColor = isSelected ? SLOT_COLORS[idx] : '#94a3b8'
                  return (
                    <li key={s.exerciseId} className="group grid cursor-pointer items-center gap-[10px] border-t border-slate-100 px-3.5 py-2.5 hover:bg-slate-50 sm:gap-[14px] grid-cols-[28px_minmax(0,1fr)_56px_76px] min-[520px]:grid-cols-[28px_minmax(0,1fr)_110px_90px]" onClick={() => toggleSlot(s.exerciseId)}>
                      <button type="button" aria-pressed={isSelected} aria-label={`Compare ${s.name}`} className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 p-0 transition-colors" style={{ borderColor: isSelected ? SLOT_COLORS[idx] : '#cbd5e1', backgroundColor: isSelected ? SLOT_COLORS[idx] : 'transparent', color: isSelected ? '#ffffff' : '#ffffff' }} onClick={(e) => { e.stopPropagation(); toggleSlot(s.exerciseId) }}>
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-3 w-3 ${isSelected ? 'opacity-100' : 'opacity-0'}`} style={isSelected && idx === 3 ? { color: '#0f172a' } : {}}>
                          <path d="M2.5 6.4l2.4 2.4 4.6-5"/>
                        </svg>
                      </button>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 break-anywhere text-[14px] font-semibold text-slate-900">
                          {s.name}
                          {d === 'flat' && <span className="rounded-full bg-slate-100 px-2 py-[1px] text-[10px] font-bold uppercase tracking-[0.04em] text-slate-600">Stalled</span>}
                        </div>
                        <div className="text-[12px] font-medium text-slate-500">{s.category}</div>
                      </div>
                      <div className="flex items-center justify-center">
                        {geo && (
                          <svg className="block w-full h-[28px]" viewBox="0 0 64 28" aria-hidden="true" preserveAspectRatio="none">
                            <path d={geo.path} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx={geo.circle.cx} cy={geo.circle.cy} r="2.8" fill={strokeColor} />
                          </svg>
                        )}
                      </div>
                      <div className="text-right tabular-nums">
                        <b className="block whitespace-nowrap text-[14px] font-bold text-slate-900">{formatMetricWeight(s.cur, metric, weightUnit)}</b>
                        <span className={`inline-flex items-center gap-1 text-[12px] font-bold ${d === 'up' ? 'text-green-700' : d === 'down' ? 'text-red-700' : 'text-slate-600'}`}>
                          {getDeltaIcon(d)}
                          {formatPercentChange(s.pct)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          </>
        ) : null}
      </div>

      {isSheetOpen && (
        <Dialog
          labelledBy="sheetTitle"
          onClose={() => setIsSheetOpen(false)}
          restoreFocusRef={sheetTriggerRef}
          overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"
          className="w-full max-w-[400px] rounded-[28px] bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="sheetTitle" className="m-0 text-[20px] font-bold tracking-[-0.02em] text-slate-900">
                {metric === 'e' ? 'Estimated 1RM' : 'Volume'}
              </h2>
              <p className="mt-1 max-w-[30ch] text-[14px] text-slate-600 [text-wrap:balance]">
                {metric === 'e' ? 'The heaviest weight you could lift once, worked out from your best set.' : 'The total weight you moved in a session.'}
              </p>
            </div>
            <button type="button" onClick={() => setIsSheetOpen(false)} className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Close">
              <XSvg />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-[20px] bg-slate-100 p-3.5">
            {metric === 'e' ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col items-center gap-1 rounded-[14px] bg-white p-2 shadow-sm">
                    <label htmlFor="wOut" className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">Weight</label>
                    <div className="flex w-full items-center justify-between gap-1">
                      <button type="button" data-step="w-" {...wMinus} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold hover:bg-slate-200 active:scale-95 active:bg-slate-300 touch-none select-none" aria-label="Lower weight">−</button>
                      <output id="wOut" className="flex-1 text-center text-[22px] font-extrabold tracking-[-0.03em] tabular-nums text-slate-900">{calcW}<small className="ml-0.5 text-[12px] font-semibold tracking-normal text-slate-600">{weightUnit === 'LB' ? 'lb' : 'kg'}</small></output>
                      <button type="button" data-step="w+" {...wPlus} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold hover:bg-slate-200 active:scale-95 active:bg-slate-300 touch-none select-none" aria-label="Raise weight">+</button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-[14px] bg-white p-2 shadow-sm">
                    <label htmlFor="rOut" className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">Reps</label>
                    <div className="flex w-full items-center justify-between gap-1">
                      <button type="button" data-step="r-" {...rMinus} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold hover:bg-slate-200 active:scale-95 active:bg-slate-300 touch-none select-none" aria-label="Fewer reps">−</button>
                      <output id="rOut" className="flex-1 text-center text-[22px] font-extrabold tracking-[-0.03em] tabular-nums text-slate-900">{calcR}</output>
                      <button type="button" data-step="r+" {...rPlus} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold hover:bg-slate-200 active:scale-95 active:bg-slate-300 touch-none select-none" aria-label="More reps">+</button>
                    </div>
                  </div>
                </div>
                <div className="text-center" aria-live="polite">
                  <div className="text-[36px] font-extrabold leading-[1.1] tracking-[-0.04em] tabular-nums text-slate-900">
                    {new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(calcR <= 1 ? calcW : calcW * (1 + calcR / 30))} {weightUnit === 'LB' ? 'lb' : 'kg'}
                  </div>
                  <div className="mt-0.5 text-[13px] tabular-nums text-slate-600">
                    {calcR <= 1 ? 'One rep is already your max' : `${calcW} × (1 + ${calcR} ÷ 30)`}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="text-[36px] font-extrabold leading-[1.1] tracking-[-0.04em] tabular-nums text-slate-900">1,920 {weightUnit === 'LB' ? 'lb' : 'kg'}</div>
                <div className="mt-0.5 text-[13px] tabular-nums text-slate-600">4 sets × 8 reps × 60 {weightUnit === 'LB' ? 'lb' : 'kg'}</div>
              </div>
            )}
          </div>

          <p className="mx-0.5 mt-3 text-[12px] text-slate-600">
            {metric === 'e' ? 'Most accurate for sets of 10 reps or fewer.' : 'More sets, reps or weight all raise it.'}
          </p>

          <button type="button" id="sheetDone" onClick={() => setIsSheetOpen(false)} className="mt-3.5 flex h-12 w-full items-center justify-center rounded-[14px] bg-slate-900 text-[14px] font-bold text-white transition-colors hover:bg-slate-800">
            Got it
          </button>
        </Dialog>
      )}
      <BottomTabBar />
    </main>
  )
}
