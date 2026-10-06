import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiStartupGate } from '../components/startup/ApiStartupGate'
import { waitForApiReadiness } from '../lib/apiReadiness'
import { resetApiAvailability } from '../lib/apiAvailability'

vi.mock('../lib/apiReadiness', () => ({ waitForApiReadiness: vi.fn() }))
const mockedReadiness = vi.mocked(waitForApiReadiness)

describe('ApiStartupGate', () => {
  beforeEach(() => {
    resetApiAvailability()
    mockedReadiness.mockReset().mockReturnValue(new Promise<void>(() => undefined))
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('holds children until readiness succeeds', async () => {
    let resolve: () => void = () => undefined
    mockedReadiness.mockReturnValue(new Promise<void>((done) => { resolve = done }))
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    expect(screen.getByRole('status')).toHaveTextContent('Starting RepLog')
    expect(screen.getByRole('status')).not.toHaveTextContent(/\d+ seconds/)
    expect(screen.getByRole('progressbar', { name: 'Current readiness attempt' })).toHaveAttribute('aria-valuemax', '90')
    resolve()
    expect(await screen.findByText('Application')).toBeInTheDocument()
  })

  it('shows a bounded failure state', async () => {
    mockedReadiness.mockRejectedValue(new Error('unavailable'))
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('Application')).not.toBeInTheDocument()
  })

  it('keeps the mounted application when connectivity drops after startup', async () => {
    mockedReadiness.mockResolvedValue(undefined)
    render(<ApiStartupGate><p>Active workout</p></ApiStartupGate>)
    expect(await screen.findByText('Active workout')).toBeInTheDocument()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await act(async () => { window.dispatchEvent(new Event('offline')) })
    expect(screen.getByText('Active workout')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('shows recovery immediately when opened offline and checks readiness on reconnect', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    mockedReadiness.mockResolvedValue(undefined)
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled()
    expect(screen.getByText('You’re offline. Reconnect to continue startup.')).toBeInTheDocument()
    expect(mockedReadiness).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    await act(async () => { window.dispatchEvent(new Event('online')) })
    expect(await screen.findByText('Application')).toBeInTheDocument()
    expect(mockedReadiness).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending startup check offline and retries immediately on reconnect', async () => {
    const signals: AbortSignal[] = []
    mockedReadiness.mockImplementation(({ signal }) => {
      signals.push(signal!)
      return new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      })
    })
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    await waitFor(() => expect(signals).toHaveLength(1))

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await act(async () => { window.dispatchEvent(new Event('offline')) })
    await waitFor(() => expect(signals[0]?.aborted).toBe(true))
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled()

    mockedReadiness.mockImplementationOnce(async () => undefined)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    await act(async () => { window.dispatchEvent(new Event('online')) })
    expect(await screen.findByText('Application')).toBeInTheDocument()
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
  })

  it('starts a new check when reconnect races the old shared flight settling', async () => {
    const signals: AbortSignal[] = []
    mockedReadiness.mockImplementation(({ signal }) => {
      signals.push(signal!)
      return signals.length === 1 ? new Promise<void>(() => undefined) : Promise.resolve()
    })
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    await waitFor(() => expect(mockedReadiness).toHaveBeenCalledTimes(1))

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
      window.dispatchEvent(new Event('offline'))
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
      window.dispatchEvent(new Event('online'))
    })

    expect(await screen.findByText('Application')).toBeInTheDocument()
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
    expect(signals[0]?.aborted).toBe(true)
  })

  it('automatically retries after the deadline and recovers without overlapping checks', async () => {
    vi.useFakeTimers()
    mockedReadiness.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(undefined)
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(screen.getByText('Application')).toBeInTheDocument()
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('resets attempt progress on retry while retaining total wait and stable announcements', async () => {
    vi.useFakeTimers()
    let rejectFirst: (error: Error) => void = () => undefined
    mockedReadiness
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<void>(() => undefined))
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(7000) })
    expect(screen.getByText('Total waiting: 7s')).toBeInTheDocument()
    expect(screen.getByText('Current attempt: 7s / 90s')).toBeInTheDocument()

    await act(async () => { rejectFirst(new Error('unavailable')); await Promise.resolve() })
    expect(screen.getByRole('status')).toHaveTextContent('RepLog unavailable. Retrying automatically.')
    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Total waiting: 22s')).toBeInTheDocument()
    expect(screen.getByText('Current attempt: 0s / 90s')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Current readiness attempt' })).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('status')).toHaveTextContent('Retrying RepLog')

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByText('Total waiting: 25s')).toBeInTheDocument()
    expect(screen.getByText('Current attempt: 3s / 90s')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Retrying RepLog')
    expect(screen.getByRole('status')).not.toHaveTextContent(/25s|3s/)
    vi.useRealTimers()
  })

  it('retains total wait through an offline pause and resets attempt time on reconnect', async () => {
    vi.useFakeTimers()
    let resolveSecond: () => void = () => undefined
    mockedReadiness
      .mockImplementationOnce(() => new Promise<void>(() => undefined))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSecond = resolve }))
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await act(async () => { window.dispatchEvent(new Event('offline')) })
    expect(screen.getByText('Total waiting: 5s')).toBeInTheDocument()
    expect(screen.getByText('Current attempt: paused while offline')).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(screen.getByText('Total waiting: 9s')).toBeInTheDocument()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    await act(async () => { window.dispatchEvent(new Event('online')); await Promise.resolve(); await Promise.resolve() })
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Total waiting: 9s')).toBeInTheDocument()
    expect(screen.getByText('Current attempt: 0s / 90s')).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByText('Total waiting: 11s')).toBeInTheDocument()
    expect(screen.getByText('Current attempt: 2s / 90s')).toBeInTheDocument()
    await act(async () => { resolveSecond(); await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('Application')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('stops automatic retries offline and resumes immediately after reconnection', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    mockedReadiness.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(undefined)
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await act(async () => { window.dispatchEvent(new Event('offline')) })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    await act(async () => { window.dispatchEvent(new Event('online')); await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('Application')).toBeInTheDocument()
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('shows a configuration error without checking readiness', () => {
    render(<ApiStartupGate configurationError={new Error('invalid URL')}><p>Application</p></ApiStartupGate>)
    expect(screen.getByRole('heading', { name: 'RepLog could not start' })).toBeInTheDocument()
    expect(screen.getByText(/API URL is not configured correctly/)).toBeInTheDocument()
    expect(mockedReadiness).not.toHaveBeenCalled()
  })
})
