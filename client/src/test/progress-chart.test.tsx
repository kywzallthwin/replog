import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressChart } from '../components/progress/ProgressChart'
import {
  buildProgressChartGeometry,
  buildProgressChartPoints,
  CHART_PLOT_BOTTOM,
  CHART_PLOT_CENTER_X,
  CHART_PLOT_CENTER_Y,
  CHART_PLOT_LEFT,
  CHART_PLOT_RIGHT,
  CHART_PLOT_TOP,
  MAX_AXIS_DATE_LABELS,
} from '../components/progress/progressChartGeometry'
import type { ProgressSessionHistory } from '../lib/progress'

function makeSession(
  id: string,
  workoutDate: string,
  estimatedOneRepMaxKg: number,
  weightKg = 80,
  reps = 8,
): ProgressSessionHistory {
  return {
    sessionId: id,
    startedAt: `${workoutDate}T10:00:00.000Z`,
    workoutDate,
    dayName: 'Pull A',
    topSet: {
      estimatedOneRepMaxKg,
      weightKg,
      reps,
    },
  }
}

describe('ProgressChart geometry and states', () => {
  it('handles 0 sessions with an empty state and no invalid SVG geometry', () => {
    const points = buildProgressChartPoints([], [])
    const geometry = buildProgressChartGeometry(points, 'KG')

    expect(geometry.status).toBe('empty')
    expect(geometry.points).toHaveLength(0)
    expect(geometry.polylinePoints).toBe('')

    render(
      <ProgressChart
        exerciseName="Lat Pulldown"
        sessionHistory={[]}
        trendEstimatedOneRepMaxKg={[]}
        weightUnit="KG"
      />,
    )

    const figure = screen.getByRole('figure', { name: 'Estimated 1RM chart for Lat Pulldown' })
    const svg = within(figure).getByRole('img', {
      name: 'Estimated 1RM chart for Lat Pulldown: no completed working-set sessions yet.',
    })

    expect(within(figure).getByText('Estimated 1RM (kg)')).toBeInTheDocument()
    expect(within(figure).getByText('No sessions yet')).toBeInTheDocument()
    expect(svg.querySelector('polyline')).toBeNull()
    expect(svg.querySelectorAll('circle')).toHaveLength(0)
  })

  it('handles 1 session by centering a single point without rendering a degenerate polyline', () => {
    const singleHistory = [makeSession('s1', '2026-06-13', 45.9, 32, 13)]
    const points = buildProgressChartPoints(singleHistory, [45.9])
    const geometry = buildProgressChartGeometry(points, 'KG')

    expect(geometry.status).toBe('single')
    expect(geometry.points).toHaveLength(1)
    expect(geometry.points[0]?.x).toBe(CHART_PLOT_CENTER_X)
    expect(geometry.points[0]?.y).toBe(CHART_PLOT_CENTER_Y)
    expect(geometry.polylinePoints).toBe('')

    render(
      <ProgressChart
        exerciseName="Lat Pulldown"
        sessionHistory={singleHistory}
        trendEstimatedOneRepMaxKg={[45.9]}
        weightUnit="KG"
      />,
    )

    const figure = screen.getByRole('figure', { name: 'Estimated 1RM chart for Lat Pulldown' })
    const svg = within(figure).getByRole('img', {
      name: /1 session on Jun 13 at 45.9 kg\. Complete another session to plot a trend line\./,
    })

    expect(svg.querySelector('polyline')).toBeNull()
    const circles = svg.querySelectorAll('circle')
    expect(circles).toHaveLength(1)
    expect(circles[0]).toHaveAttribute('cx', String(CHART_PLOT_CENTER_X))
    expect(circles[0]).toHaveAttribute('cy', String(CHART_PLOT_CENTER_Y))
    expect(within(figure).getByText('1 session · 45.9 kg')).toBeInTheDocument()
    expect(within(figure).getByText('Jun 13')).toBeInTheDocument()
  })

  it('handles flat 2+ session series without division-by-zero or NaN coordinates', () => {
    const historyNewestFirst = [
      makeSession('s3', '2026-06-25', 100),
      makeSession('s2', '2026-06-20', 100),
      makeSession('s1', '2026-06-13', 100),
    ]
    const points = buildProgressChartPoints(historyNewestFirst, [100, 100, 100])
    const geometry = buildProgressChartGeometry(points, 'KG')

    expect(geometry.status).toBe('flat')
    expect(geometry.points.map((point) => point.x)).toEqual([30, 150, 270])
    expect(geometry.points.map((point) => point.y)).toEqual([
      CHART_PLOT_CENTER_Y,
      CHART_PLOT_CENTER_Y,
      CHART_PLOT_CENTER_Y,
    ])
    expect(geometry.polylinePoints).toBe('30,60 150,60 270,60')

    render(
      <ProgressChart
        exerciseName="Bench Press"
        sessionHistory={historyNewestFirst}
        trendEstimatedOneRepMaxKg={[100, 100, 100]}
        weightUnit="KG"
      />,
    )

    const figure = screen.getByRole('figure', { name: 'Estimated 1RM chart for Bench Press' })
    expect(within(figure).getByText('Steady · 100 kg')).toBeInTheDocument()
    expect(
      within(figure).getByRole('img', {
        name: /steady at 100 kg \(0 kg change\)/,
      }),
    ).toBeInTheDocument()
  })

  it('orders chronological points from newest-first sessionHistory and scales increasing and decreasing series within bounds', () => {
    const increasingNewestFirst = [
      makeSession('s3', '2026-06-25', 45.9, 32, 13),
      makeSession('s2', '2026-06-20', 44.8, 32, 12),
      makeSession('s1', '2026-06-13', 38.7, 27, 13),
    ]
    const increasingPoints = buildProgressChartPoints(increasingNewestFirst, [38.7, 44.8, 45.9])
    const increasingGeometry = buildProgressChartGeometry(increasingPoints, 'KG')

    expect(increasingGeometry.status).toBe('up')
    expect(increasingGeometry.points.map((point) => point.dateLabel)).toEqual(['Jun 13', 'Jun 20', 'Jun 25'])
    expect(increasingGeometry.points.map((point) => point.x)).toEqual([
      CHART_PLOT_LEFT,
      CHART_PLOT_CENTER_X,
      CHART_PLOT_RIGHT,
    ])
    // Higher 1RM values plot higher in the SVG (smaller y coordinate)
    expect(increasingGeometry.points[0]?.y).toBe(CHART_PLOT_BOTTOM)
    expect(increasingGeometry.points[2]?.y).toBe(CHART_PLOT_TOP)
    expect(increasingGeometry.points[1]!.y).toBeGreaterThan(CHART_PLOT_TOP)
    expect(increasingGeometry.points[1]!.y).toBeLessThan(CHART_PLOT_BOTTOM)

    const decreasingNewestFirst = [...increasingNewestFirst].reverse()
    const decreasingPoints = buildProgressChartPoints(decreasingNewestFirst, [45.9, 44.8, 38.7])
    const decreasingGeometry = buildProgressChartGeometry(decreasingPoints, 'KG')

    expect(decreasingGeometry.status).toBe('down')
    expect(decreasingGeometry.points[0]?.y).toBe(CHART_PLOT_TOP)
    expect(decreasingGeometry.points[2]?.y).toBe(CHART_PLOT_BOTTOM)
    expect(decreasingGeometry.formattedDelta).toBe('-7.2 kg')
  })

  it('formats chart axis, point titles, and accessible summary in LB when user preference is LB', () => {
    const historyNewestFirst = [
      makeSession('s3', '2026-06-25', 45.9, 32, 13),
      makeSession('s2', '2026-06-20', 44.8, 32, 12),
      makeSession('s1', '2026-06-13', 38.7, 27, 13),
    ]

    render(
      <ProgressChart
        exerciseName="Lat Pulldown"
        sessionHistory={historyNewestFirst}
        trendEstimatedOneRepMaxKg={[38.7, 44.8, 45.9]}
        weightUnit="LB"
      />,
    )

    const figure = screen.getByRole('figure', { name: 'Estimated 1RM chart for Lat Pulldown' })
    expect(within(figure).getByText('Estimated 1RM (lb)')).toBeInTheDocument()
    expect(within(figure).getByText('85.3 lb – 101.2 lb')).toBeInTheDocument()

    const svg = within(figure).getByRole('img', {
      name: /Estimated 1RM chart for Lat Pulldown across 3 sessions from Jun 13 to Jun 25: starts at 85.3 lb, latest 101.2 lb, range 85.3 lb to 101.2 lb, trend increasing \(\+15.9 lb\)\./,
    })

    const pointTitles = Array.from(svg.querySelectorAll('circle title')).map((node) => node.textContent)
    expect(pointTitles).toEqual(['Jun 13: 85.3 lb', 'Jun 20: 98.8 lb', 'Jun 25: 101.2 lb'])
  })

  it('downsamples X-axis date labels on dense series to prevent 375px horizontal overflow', () => {
    const denseHistoryNewestFirst = Array.from({ length: 10 }, (_, idx) => {
      const sessionNumber = 10 - idx
      const day = String(sessionNumber).padStart(2, '0')
      return makeSession(`s-${sessionNumber}`, `2026-06-${day}`, 60 + sessionNumber * 2.5)
    })
    const trendKg = [...denseHistoryNewestFirst].reverse().map((s) => s.topSet.estimatedOneRepMaxKg)

    render(
      <ProgressChart
        exerciseName="Barbell Row"
        sessionHistory={denseHistoryNewestFirst}
        trendEstimatedOneRepMaxKg={trendKg}
        weightUnit="KG"
      />,
    )

    const figure = screen.getByRole('figure', { name: 'Estimated 1RM chart for Barbell Row' })
    expect(figure).toHaveClass('min-w-0', 'overflow-hidden')

    const svg = within(figure).getByRole('img')
    expect(svg).toHaveClass('w-full', 'max-w-full')
    expect(svg.querySelectorAll('circle')).toHaveLength(10)

    const axisPoints = buildProgressChartGeometry(
      buildProgressChartPoints(denseHistoryNewestFirst, trendKg),
      'KG',
    ).axisPoints
    expect(axisPoints).toHaveLength(MAX_AXIS_DATE_LABELS)
    expect(axisPoints[0]?.dateLabel).toBe('Jun 1')
    expect(axisPoints[axisPoints.length - 1]?.dateLabel).toBe('Jun 10')
  })
})
