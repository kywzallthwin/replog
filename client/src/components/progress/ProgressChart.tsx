import type { ProgressSessionHistory } from '../../lib/progress'
import { DEFAULT_WEIGHT_UNIT, type WeightUnit } from '../../lib/units'
import {
  buildProgressChartGeometry,
  buildProgressChartPoints,
  buildProgressChartSummary,
  CHART_PLOT_BOTTOM,
  CHART_PLOT_CENTER_Y,
  CHART_PLOT_LEFT,
  CHART_PLOT_RIGHT,
  CHART_PLOT_TOP,
  CHART_POINT_RADIUS,
} from './progressChartGeometry'

type ProgressChartProps = {
  exerciseName: string
  sessionHistory: ProgressSessionHistory[]
  trendEstimatedOneRepMaxKg: number[]
  weightUnit?: WeightUnit
}

export function ProgressChart({
  exerciseName,
  sessionHistory,
  trendEstimatedOneRepMaxKg,
  weightUnit = DEFAULT_WEIGHT_UNIT,
}: ProgressChartProps) {
  const inputPoints = buildProgressChartPoints(sessionHistory, trendEstimatedOneRepMaxKg)
  const geometry = buildProgressChartGeometry(inputPoints, weightUnit)
  const summaryText = buildProgressChartSummary(exerciseName, geometry)

  const scaleBadgeText =
    geometry.status === 'empty'
      ? 'No sessions yet'
      : geometry.status === 'single'
        ? `1 session · ${geometry.formattedLatest}`
        : geometry.status === 'flat'
          ? `Steady · ${geometry.formattedLatest}`
          : `${geometry.formattedMin} – ${geometry.formattedMax}`

  return (
    <figure
      aria-label={`Estimated 1RM chart for ${exerciseName}`}
      className="mb-4 min-w-0 overflow-hidden rounded-[14px] bg-slate-50 p-3.5"
    >
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-slate-500">
          {`Estimated 1RM (${geometry.unitLabel})`}
        </span>
        <span className="min-w-0 break-words text-[11px] font-bold text-slate-600 [overflow-wrap:anywhere]">
          {scaleBadgeText}
        </span>
      </div>

      <svg
        viewBox={geometry.viewBox}
        role="img"
        aria-label={summaryText}
        className="block h-auto w-full max-w-full overflow-visible"
      >
        {geometry.status === 'empty' || geometry.status === 'single' || geometry.status === 'flat' ? (
          <line
            x1={CHART_PLOT_LEFT}
            y1={CHART_PLOT_CENTER_Y}
            x2={CHART_PLOT_RIGHT}
            y2={CHART_PLOT_CENTER_Y}
            stroke="#e2e8f0"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ) : (
          <>
            <line
              x1={CHART_PLOT_LEFT}
              y1={CHART_PLOT_TOP}
              x2={CHART_PLOT_RIGHT}
              y2={CHART_PLOT_TOP}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1={CHART_PLOT_LEFT}
              y1={CHART_PLOT_BOTTOM}
              x2={CHART_PLOT_RIGHT}
              y2={CHART_PLOT_BOTTOM}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </>
        )}

        {geometry.polylinePoints ? (
          <polyline
            fill="none"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={geometry.polylinePoints}
          />
        ) : null}

        {geometry.points.map((point) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r={CHART_POINT_RADIUS}
            fill="#0f172a"
            data-point-date={point.dateLabel}
            data-point-value={point.formattedValue}
          >
            <title>{`${point.dateLabel}: ${point.formattedValue}`}</title>
          </circle>
        ))}
      </svg>

      {geometry.axisPoints.length > 0 ? (
        <div
          aria-hidden="true"
          className={`mt-1.5 flex min-w-0 items-center gap-2 text-[11px] font-bold text-slate-500 ${
            geometry.axisPoints.length === 1 ? 'justify-center' : 'justify-between'
          }`}
        >
          {geometry.axisPoints.map((point) => (
            <span
              key={`axis-${point.id}`}
              className="min-w-0 truncate"
            >
              {point.dateLabel}
            </span>
          ))}
        </div>
      ) : null}

      {geometry.status === 'empty' ? (
        <p className="mt-1.5 text-center text-xs font-medium text-slate-500">
          Complete a session with working sets to plot estimated 1RM progress.
        </p>
      ) : null}

      {geometry.status === 'single' ? (
        <p className="mt-1 text-center text-xs font-medium text-slate-500">
          Log one more session to draw a trend line.
        </p>
      ) : null}

      <figcaption className="sr-only">{summaryText}</figcaption>
    </figure>
  )
}
