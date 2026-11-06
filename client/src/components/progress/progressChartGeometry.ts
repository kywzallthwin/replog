import type { ProgressSessionHistory } from '../../lib/progress'
import {
  convertWeightFromKg,
  DEFAULT_WEIGHT_UNIT,
  formatEstimatedOneRepMax,
  formatProgressDelta,
  getWeightUnitLabel,
  roundToSingleDecimal,
  type WeightUnit,
} from '../../lib/units'

export const CHART_VIEWBOX_WIDTH = 300
export const CHART_VIEWBOX_HEIGHT = 120
export const CHART_PLOT_LEFT = 30
export const CHART_PLOT_RIGHT = 270
export const CHART_PLOT_TOP = 24
export const CHART_PLOT_BOTTOM = 96
export const CHART_PLOT_CENTER_X = (CHART_PLOT_LEFT + CHART_PLOT_RIGHT) / 2
export const CHART_PLOT_CENTER_Y = (CHART_PLOT_TOP + CHART_PLOT_BOTTOM) / 2
export const CHART_POINT_RADIUS = 4
export const MAX_AXIS_DATE_LABELS = 4

export type ProgressChartInputPoint = {
  id: string
  dateLabel: string
  dateTime?: string
  estimatedOneRepMaxKg: number
}

export type ProgressChartPlottedPoint = ProgressChartInputPoint & {
  index: number
  x: number
  y: number
  displayValue: number
  formattedValue: string
}

export type ProgressChartSeriesStatus = 'empty' | 'single' | 'flat' | 'up' | 'down' | 'steady'

export type ProgressChartGeometry = {
  viewBox: string
  status: ProgressChartSeriesStatus
  unitLabel: 'kg' | 'lb'
  points: ProgressChartPlottedPoint[]
  axisPoints: ProgressChartPlottedPoint[]
  polylinePoints: string
  minEstimatedOneRepMaxKg: number | null
  maxEstimatedOneRepMaxKg: number | null
  formattedMin: string | null
  formattedMax: string | null
  formattedFirst: string | null
  formattedLatest: string | null
  formattedDelta: string
}

export function formatProgressShortDate(startedAt: string, workoutDate?: string | null) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
  }).format(workoutDate ? new Date(`${workoutDate.slice(0, 10)}T12:00:00`) : new Date(startedAt))
}

function roundCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  const rounded = Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

function sanitizeWeightKg(weightKg: number): number {
  return Number.isFinite(weightKg) && weightKg >= 0 ? weightKg : 0
}

export function buildProgressChartPoints(
  sessionHistory: ProgressSessionHistory[],
  trendEstimatedOneRepMaxKg: number[] = [],
): ProgressChartInputPoint[] {
  const chronologicalSessions = [...sessionHistory].reverse()
  const sanitizedTrend = trendEstimatedOneRepMaxKg.map(sanitizeWeightKg)

  if (chronologicalSessions.length === 0) {
    return sanitizedTrend.map((estimatedOneRepMaxKg, index) => ({
      id: `trend-${index + 1}`,
      dateLabel: `Session ${index + 1}`,
      estimatedOneRepMaxKg,
    }))
  }

  if (sanitizedTrend.length === chronologicalSessions.length) {
    return chronologicalSessions.map((session, index) => ({
      id: session.sessionId,
      dateLabel: formatProgressShortDate(session.startedAt, session.workoutDate),
      dateTime: session.workoutDate ?? session.startedAt,
      estimatedOneRepMaxKg: sanitizedTrend[index] ?? sanitizeWeightKg(session.topSet.estimatedOneRepMaxKg),
    }))
  }

  const latestSession = chronologicalSessions[chronologicalSessions.length - 1]
  if (
    chronologicalSessions.length === 1 &&
    sanitizedTrend.length > 1 &&
    latestSession &&
    Math.abs(
      (sanitizedTrend[sanitizedTrend.length - 1] ?? 0) -
        sanitizeWeightKg(latestSession.topSet.estimatedOneRepMaxKg),
    ) < 1e-6
  ) {
    return sanitizedTrend.map((estimatedOneRepMaxKg, index) => {
      const isLast = index === sanitizedTrend.length - 1
      return {
        id: isLast ? latestSession.sessionId : `trend-${index + 1}`,
        dateLabel: isLast
          ? formatProgressShortDate(latestSession.startedAt, latestSession.workoutDate)
          : `Session ${index + 1}`,
        dateTime: isLast ? (latestSession.workoutDate ?? latestSession.startedAt) : undefined,
        estimatedOneRepMaxKg,
      }
    })
  }

  return chronologicalSessions.map((session) => ({
    id: session.sessionId,
    dateLabel: formatProgressShortDate(session.startedAt, session.workoutDate),
    dateTime: session.workoutDate ?? session.startedAt,
    estimatedOneRepMaxKg: sanitizeWeightKg(session.topSet.estimatedOneRepMaxKg),
  }))
}

export function selectProgressChartAxisPoints(
  points: ProgressChartPlottedPoint[],
  maxLabels = MAX_AXIS_DATE_LABELS,
): ProgressChartPlottedPoint[] {
  if (points.length <= maxLabels || maxLabels < 2) {
    return points
  }

  const selectedIndices: number[] = []
  for (let slot = 0; slot < maxLabels; slot += 1) {
    const index = Math.round((slot * (points.length - 1)) / (maxLabels - 1))
    if (!selectedIndices.includes(index)) {
      selectedIndices.push(index)
    }
  }

  return selectedIndices.map((index) => points[index]).filter((point): point is ProgressChartPlottedPoint => Boolean(point))
}

export function buildProgressChartGeometry(
  inputPoints: ProgressChartInputPoint[],
  weightUnit: WeightUnit = DEFAULT_WEIGHT_UNIT,
): ProgressChartGeometry {
  const unitLabel = getWeightUnitLabel(weightUnit)
  const viewBox = `0 0 ${CHART_VIEWBOX_WIDTH} ${CHART_VIEWBOX_HEIGHT}`

  if (inputPoints.length === 0) {
    return {
      viewBox,
      status: 'empty',
      unitLabel,
      points: [],
      axisPoints: [],
      polylinePoints: '',
      minEstimatedOneRepMaxKg: null,
      maxEstimatedOneRepMaxKg: null,
      formattedMin: null,
      formattedMax: null,
      formattedFirst: null,
      formattedLatest: null,
      formattedDelta: formatProgressDelta(0, weightUnit),
    }
  }

  const sanitized = inputPoints.map((point) => {
    const estimatedOneRepMaxKg = sanitizeWeightKg(point.estimatedOneRepMaxKg)
    const displayValue = roundToSingleDecimal(convertWeightFromKg(estimatedOneRepMaxKg, weightUnit))
    return {
      ...point,
      estimatedOneRepMaxKg,
      displayValue,
      formattedValue: formatEstimatedOneRepMax(estimatedOneRepMaxKg, weightUnit),
    }
  })

  let minEntry = sanitized[0]!
  let maxEntry = sanitized[0]!
  for (const entry of sanitized) {
    if (entry.displayValue < minEntry.displayValue) {
      minEntry = entry
    }
    if (entry.displayValue > maxEntry.displayValue) {
      maxEntry = entry
    }
  }

  const firstEntry = sanitized[0]!
  const latestEntry = sanitized[sanitized.length - 1]!
  const deltaKg = latestEntry.estimatedOneRepMaxKg - firstEntry.estimatedOneRepMaxKg

  if (sanitized.length === 1) {
    const singlePoint: ProgressChartPlottedPoint = {
      ...firstEntry,
      index: 0,
      x: CHART_PLOT_CENTER_X,
      y: CHART_PLOT_CENTER_Y,
    }

    return {
      viewBox,
      status: 'single',
      unitLabel,
      points: [singlePoint],
      axisPoints: [singlePoint],
      polylinePoints: '',
      minEstimatedOneRepMaxKg: firstEntry.estimatedOneRepMaxKg,
      maxEstimatedOneRepMaxKg: firstEntry.estimatedOneRepMaxKg,
      formattedMin: firstEntry.formattedValue,
      formattedMax: firstEntry.formattedValue,
      formattedFirst: firstEntry.formattedValue,
      formattedLatest: firstEntry.formattedValue,
      formattedDelta: formatProgressDelta(0, weightUnit),
    }
  }

  const plotWidth = CHART_PLOT_RIGHT - CHART_PLOT_LEFT
  const plotHeight = CHART_PLOT_BOTTOM - CHART_PLOT_TOP
  const valueSpan = maxEntry.displayValue - minEntry.displayValue
  const isFlat = valueSpan === 0

  const plottedPoints: ProgressChartPlottedPoint[] = sanitized.map((entry, index) => {
    const xRatio = index / (sanitized.length - 1)
    const x = roundCoordinate(CHART_PLOT_LEFT + xRatio * plotWidth)
    const y = isFlat
      ? CHART_PLOT_CENTER_Y
      : roundCoordinate(
          CHART_PLOT_BOTTOM - ((entry.displayValue - minEntry.displayValue) / valueSpan) * plotHeight,
        )

    return {
      ...entry,
      index,
      x,
      y,
    }
  })

  const status: ProgressChartSeriesStatus = isFlat
    ? 'flat'
    : latestEntry.displayValue > firstEntry.displayValue
      ? 'up'
      : latestEntry.displayValue < firstEntry.displayValue
        ? 'down'
        : 'steady'

  return {
    viewBox,
    status,
    unitLabel,
    points: plottedPoints,
    axisPoints: selectProgressChartAxisPoints(plottedPoints),
    polylinePoints: plottedPoints.map((point) => `${point.x},${point.y}`).join(' '),
    minEstimatedOneRepMaxKg: minEntry.estimatedOneRepMaxKg,
    maxEstimatedOneRepMaxKg: maxEntry.estimatedOneRepMaxKg,
    formattedMin: minEntry.formattedValue,
    formattedMax: maxEntry.formattedValue,
    formattedFirst: firstEntry.formattedValue,
    formattedLatest: latestEntry.formattedValue,
    formattedDelta: formatProgressDelta(deltaKg, weightUnit),
  }
}

export function buildProgressChartSummary(
  exerciseName: string,
  geometry: ProgressChartGeometry,
): string {
  const { points, status, formattedFirst, formattedLatest, formattedMin, formattedMax, formattedDelta } = geometry

  if (status === 'empty' || points.length === 0) {
    return `Estimated 1RM chart for ${exerciseName}: no completed working-set sessions yet.`
  }

  const firstPoint = points[0]!
  const latestPoint = points[points.length - 1]!

  if (status === 'single' || points.length === 1) {
    return `Estimated 1RM chart for ${exerciseName}: 1 session on ${firstPoint.dateLabel} at ${firstPoint.formattedValue}. Complete another session to plot a trend line.`
  }

  if (status === 'flat') {
    return `Estimated 1RM chart for ${exerciseName} across ${points.length} sessions from ${firstPoint.dateLabel} to ${latestPoint.dateLabel}: steady at ${formattedLatest} (${formattedDelta} change).`
  }

  const directionText =
    status === 'up'
      ? `increasing (${formattedDelta})`
      : status === 'down'
        ? `decreasing (${formattedDelta})`
        : `steady (${formattedDelta})`

  return `Estimated 1RM chart for ${exerciseName} across ${points.length} sessions from ${firstPoint.dateLabel} to ${latestPoint.dateLabel}: starts at ${formattedFirst}, latest ${formattedLatest}, range ${formattedMin} to ${formattedMax}, trend ${directionText}.`
}
