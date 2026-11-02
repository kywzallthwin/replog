import { useState, useMemo, Fragment, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getProgress, normalizeProgressData, progressQueryKey } from '../lib/progress'
import { useWeightUnit } from '../lib/units'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'
import { BrandLogo } from '../components/BrandLogo'
import { PageLoader } from '../components/ui/PageLoader'
import { FluidSelect } from '../components/forms/FluidSelect'
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

const CheckSvg = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

type SortOption = 'gain' | 'trained' | 'stalled' | 'az'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'gain', label: 'Biggest gain' },
  { value: 'trained', label: 'Most trained' },
  { value: 'stalled', label: 'Stalled first' },
  { value: 'az', label: 'A to Z' },
]

export function ProgressPage() {
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

  const stats = useMemo(() => computeExerciseRangeStats(summaries, rangeDays, metric), [summaries, rangeDays, metric])
  
  if (prevStatsLength === 0 && stats.length > 0) {
    setPrevStatsLength(stats.length)
    const top = [...stats].sort((a, b) => b.pct - a.pct).slice(0, 3)
    const newSlots = Array(MAX_COMPARE_SLOTS).fill(null)
    for (let i = 0; i < top.length; i++) {
      newSlots[i] = top[i].exerciseId
    }
    setSlots(newSlots)
  }

  const categories = useMemo(() => {
    const cats = new Set(stats.map(s => s.category))
    cats.delete('All')
    return ['All', ...Array.from(cats).sort()]
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

  const { upCount, flatCount, downCount } = useMemo(() => {
    let u = 0, f = 0, d = 0
    for (const s of stats) {
      if (s.dir === 'up') u++
      else if (s.dir === 'down') d++
      else f++
    }
    return { upCount: u, flatCount: f, downCount: d }
  }, [stats])

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

  // Chart layout
  const [activeT, setActiveT] = useState<number | null>(null)
  const chartRef = useRef<SVGSVGElement>(null)

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

    const pad = Math.max((pMax - pMin) * 0.1, 0.05)
    pMin -= pad
    pMax += pad
    
    const yTicks = niceTicks(pMin * 100, pMax * 100).map(v => v / 100)
    pMin = Math.min(pMin, yTicks[0])
    pMax = Math.max(pMax, yTicks[yTicks.length - 1])

    const xTicksList = xTicks(tMin, tMax, rangeDays)

    const W = 720
    const H = 320
    const m = { t: 20, r: 120, b: 30, l: 50 }
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
      const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
      return { s, color, coords, path }
    })

    const rightLabels = lines.map(line => ({
      id: line.s.exerciseId,
      y: line.coords[line.coords.length - 1].y,
      text: `${line.s.name} ${formatPercentChange(line.coords[line.coords.length - 1].pt.pct)}`,
      color: line.color
    }))

    resolveRightLabelsCollision(rightLabels, H, m.b)

    return { W, H, m, w, h, getX, getY, tMin, tMax, pMin, pMax, yTicks, xTicks: xTicksList, lines, rightLabels }
  }, [selectedStats, activeCount, rangeDays])

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!chartData || !chartRef.current) return
    const rect = chartRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const { m, w, tMin, tMax } = chartData
    
    if (x < m.l || x > m.l + w) {
      setActiveT(null)
      return
    }
    
    const t = tMin + ((x - m.l) / w) * (tMax - tMin)
    setActiveT(t)
  }

  const rangeLabel = rangeDays === 30 ? '30 days' : rangeDays === 90 ? '90 days' : rangeDays === 180 ? '6 months' : 'the past year'

  return (
    <main className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-slate-100 px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 lg:py-10">
      <div className="mx-auto w-full max-w-[720px] flex flex-col gap-4">
        <header className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/dashboard" aria-label="Back to dashboard" className="inline-flex items-center">
              <BrandLogo className="h-6 w-auto" />
            </Link>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">Progress</h1>
          </div>
          <TopNav />
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
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">No finished sets yet.</h2>
            <p className="mt-1 text-sm text-slate-500">Complete a workout with normal working sets to see exercise progress here.</p>
          </div>
        ) : null}

        {!isPending && summaries.length > 0 ? (
          <>
            <div className="controls flex flex-col sm:flex-row gap-3">
              <div role="group" aria-label="Time range" className="flex rounded-lg bg-slate-200 p-1">
                {RANGE_OPTIONS.map(val => (
                  <button
                    key={val}
                    type="button"
                    aria-pressed={rangeDays === val}
                    onClick={() => setRangeDays(val)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${rangeDays === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {val === 30 ? '30d' : val === 90 ? '90d' : val === 180 ? '6m' : '1y'}
                  </button>
                ))}
              </div>
              <div role="group" aria-label="Metric" className="flex rounded-lg bg-slate-200 p-1">
                {METRIC_OPTIONS.map(val => (
                  <button
                    key={val}
                    type="button"
                    aria-pressed={metric === val}
                    onClick={() => setMetric(val)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${metric === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {val === 'e' ? 'Est. 1RM' : 'Volume'}
                  </button>
                ))}
              </div>
            </div>

            <div aria-live="polite" className="text-sm text-slate-600">
              ▲ <span className="font-bold text-slate-900">{upCount}</span> up, ▬ <span className="font-bold text-slate-900">{flatCount}</span> flat, ▼ <span className="font-bold text-slate-900">{downCount}</span> down, over {rangeLabel}.
            </div>

            <section aria-label="Compare exercises" className="rounded-[24px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold text-slate-900">Compare <span className="text-slate-500 font-normal">{activeCount} of 5</span></h2>
                <div role="group" aria-label="Chart view" className="flex rounded-lg bg-slate-100 p-1">
                  <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')} className={`px-3 py-1 text-xs font-bold rounded-md ${view === 'chart' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Chart</button>
                  <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} className={`px-3 py-1 text-xs font-bold rounded-md ${view === 'table' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Table</button>
                </div>
              </div>

              {showFullHint && (
                <div aria-live="polite" className="mb-4 text-xs font-medium text-amber-600 bg-amber-50 p-2 rounded">
                  The chart holds up to 5 exercises. Remove one to add another.
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {slots.map((id, idx) => {
                  if (!id) return null
                  const s = stats.find(x => x.exerciseId === id)
                  if (!s) return null
                  return (
                    <div key={id} className="flex items-center gap-1.5 rounded-full border border-slate-200 pl-2 pr-1 py-1 text-xs font-medium text-slate-700 bg-slate-50">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SLOT_COLORS[idx] }} />
                      {s.name}
                      <button type="button" aria-label={`Remove ${s.name} from chart`} onClick={() => toggleSlot(id)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600">
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>

              {activeCount === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Pick up to 5 exercises from the list below to compare how each one is moving.
                </div>
              ) : view === 'chart' && chartData ? (
                <div className="relative overflow-hidden">
                  <svg
                    ref={chartRef}
                    role="img"
                    aria-label={`Line chart of percent change in ${metric === 'e' ? 'estimated 1RM' : 'volume'} for ${selectedStats.filter(Boolean).map(s => s!.name).join(', ')}`}
                    viewBox={`0 0 ${chartData.W} ${chartData.H}`}
                    className="w-full h-auto touch-none"
                    onPointerMove={handlePointerMove}
                    onPointerDown={handlePointerMove}
                    onPointerLeave={() => setActiveT(null)}
                  >
                    {chartData.yTicks.map(y => (
                      <g key={y}>
                        <line x1={chartData.m.l} x2={chartData.W - chartData.m.r} y1={chartData.getY(y)} y2={chartData.getY(y)} stroke={y === 0 ? '#cbd5e1' : '#f1f5f9'} strokeWidth={y === 0 ? 2 : 1} />
                        <text x={chartData.m.l - 8} y={chartData.getY(y)} dy="4" textAnchor="end" fontSize="11" fill={y === 0 ? '#64748b' : '#94a3b8'} fontWeight={y === 0 ? 'bold' : 'normal'}>
                          {y === 0 ? '0%' : (y > 0 ? '+' : '') + (y * 100).toFixed(0) + '%'}
                        </text>
                      </g>
                    ))}
                    {chartData.xTicks.map(tick => (
                      <text key={tick.t} x={chartData.getX(tick.t)} y={chartData.H - chartData.m.b + 16} textAnchor="middle" fontSize="11" fill="#94a3b8">
                        {tick.label}
                      </text>
                    ))}
                    {chartData.lines.map((line) => (
                      <Fragment key={line.s.exerciseId}>
                        <path d={line.path} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        {line.coords.map((c, ci) => (
                          <circle key={ci} cx={c.x} cy={c.y} r="3.5" fill="white" stroke={line.color} strokeWidth="2" />
                        ))}
                      </Fragment>
                    ))}
                    {chartData.rightLabels.map(label => (
                      <text key={label.id} x={chartData.W - chartData.m.r + 12} y={label.y} dy="4" fontSize="11" fontWeight="bold" fill={label.color}>
                        {label.text}
                      </text>
                    ))}
                    
                    {activeT !== null && (
                      <g>
                        <line x1={chartData.getX(activeT)} x2={chartData.getX(activeT)} y1={chartData.m.t} y2={chartData.H - chartData.m.b} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
                        {chartData.lines.map(line => {
                          const closest = line.coords.reduce((a, b) => Math.abs(b.pt.t - activeT) < Math.abs(a.pt.t - activeT) ? b : a)
                          if (Math.abs(closest.pt.t - activeT) > 86400000 * 7) return null
                          return <circle key={line.s.exerciseId} cx={closest.x} cy={closest.y} r="4.5" fill={line.color} />
                        })}
                      </g>
                    )}
                  </svg>
                  
                  {activeT !== null && (
                    <div className="absolute top-2 left-16 bg-white/90 backdrop-blur border border-slate-200 p-2 rounded shadow-lg pointer-events-none text-xs">
                      <div className="font-bold text-slate-700 mb-1">
                        {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(activeT)}
                      </div>
                      {chartData.lines.map(line => {
                        const closest = line.coords.reduce((a, b) => Math.abs(b.pt.t - activeT) < Math.abs(a.pt.t - activeT) ? b : a)
                        if (Math.abs(closest.pt.t - activeT) > 86400000 * 7) return null
                        return (
                          <div key={line.s.exerciseId} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: line.color }} />
                            <span className="font-medium text-slate-700">{line.s.name}</span>
                            <span className="ml-auto font-bold">{formatPercentChange(closest.pt.pct)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : view === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2 rounded-l-lg">Exercise</th>
                        <th className="px-3 py-2 text-right">Start</th>
                        <th className="px-3 py-2 text-right">Now</th>
                        <th className="px-3 py-2 text-right rounded-r-lg">Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedStats.filter(Boolean).map(s => {
                        const idx = slots.indexOf(s!.exerciseId)
                        return (
                          <tr key={s!.exerciseId}>
                            <td className="px-3 py-3 font-medium text-slate-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SLOT_COLORS[idx] }} />
                              {s!.name}
                            </td>
                            <td className="px-3 py-3 text-right text-slate-600">{formatMetricWeight(s!.base, metric, weightUnit)}</td>
                            <td className="px-3 py-3 text-right font-bold text-slate-900">{formatMetricWeight(s!.cur, metric, weightUnit)}</td>
                            <td className="px-3 py-3 text-right font-bold" style={{ color: SLOT_COLORS[idx] }}>{formatPercentChange(s!.pct)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <section aria-label="All exercises" className="rounded-[24px] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="search"
                    placeholder="Search exercises"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 min-w-0 min-h-12 rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="w-full sm:w-[200px]">
                    <FluidSelect
                      value={sort}
                      options={SORT_OPTIONS}
                      onValueChange={(nextSort) => setSort(nextSort as SortOption)}
                      ariaLabel="Sort exercises"
                    />
                  </div>
                </div>
                <div role="group" aria-label="Muscle group" className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={muscleFilter === cat}
                      onClick={() => setMuscleFilter(cat)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${muscleFilter === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {filteredStats.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No exercises match. Clear the search or pick another muscle group.
                </div>
              ) : (
                <ul className="rows flex flex-col divide-y divide-slate-100">
                  {filteredStats.map(s => {
                    const idx = slots.indexOf(s.exerciseId)
                    const isSelected = idx >= 0
                    const geo = buildSparklineGeometry(s.pts)
                    return (
                      <li key={s.exerciseId} className="row grid grid-cols-[28px_minmax(0,1fr)_64px_84px] sm:grid-cols-[28px_minmax(0,1fr)_120px_96px] items-center gap-2 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => toggleSlot(s.exerciseId)}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`Compare ${s.name}`}
                          className="pick w-5 h-5 rounded-full border flex items-center justify-center transition-colors"
                          style={{
                            borderColor: isSelected ? SLOT_COLORS[idx] : '#cbd5e1',
                            backgroundColor: isSelected ? SLOT_COLORS[idx] : 'transparent'
                          }}
                          onClick={(e) => { e.stopPropagation(); toggleSlot(s.exerciseId) }}
                        >
                          {isSelected && <CheckSvg />}
                        </button>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate text-sm">{s.name}</div>
                          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                            {s.category} · {s.n} sessions
                            {s.dir === 'flat' && <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold uppercase tracking-wider text-[9px]">Stalled</span>}
                          </div>
                        </div>
                        <div className="flex items-center justify-center">
                          {geo && (
                            <svg width="100%" height="28" viewBox="0 0 64 28" aria-hidden="true" preserveAspectRatio="none">
                              <path d={geo.path} fill="none" stroke={s.dir === 'up' ? '#16a34a' : s.dir === 'down' ? '#dc2626' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              <circle cx={geo.circle.cx} cy={geo.circle.cy} r={geo.circle.r} fill={s.dir === 'up' ? '#16a34a' : s.dir === 'down' ? '#dc2626' : '#94a3b8'} />
                            </svg>
                          )}
                        </div>
                        <div className="text-right min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate">{formatMetricWeight(s.cur, metric, weightUnit)}</div>
                          <div className={`text-xs font-bold ${s.dir === 'up' ? 'text-green-600' : s.dir === 'down' ? 'text-red-600' : 'text-slate-500'}`}>
                            {formatPercentChange(s.pct)}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            
            <p className="mt-8 text-[11px] leading-relaxed text-slate-400">
              Est. 1RM uses the Epley formula, weight × (1 + reps ÷ 30), on your best set of each session. Volume is sets × reps × weight. Change compares your latest session with the average of the first two sessions in the range. Tap a row to add or remove it from the chart.
            </p>
          </>
        ) : null}
      </div>
      <BottomTabBar />
    </main>
  )
}