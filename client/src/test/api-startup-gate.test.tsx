import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('holds children until readiness succeeds with immediate BrandedLoader and no cold-start clutter before 3 seconds', async () => {
    let resolve: () => void = () => undefined
    mockedReadiness.mockReturnValue(new Promise<void>((done) => { resolve = done }))
    const { container } = render(<ApiStartupGate><p>Application</p></ApiStartupGate>)

    expect(container.querySelector('.replog-loader')).toHaveClass('min-h-dvh', 'place-content-center')
    expect(container.querySelector('[data-loader-monogram]')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Starting RepLog')
    expect(screen.getByRole('status')).toHaveClass('sr-only')
    expect(screen.queryByText('Starting RepLog…')).not.toBeInTheDocument()
    expect(screen.queryByText(/Waking the service/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Current attempt|Total waiting|\d+s/)).not.toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()

    resolve()
    expect(await screen.findByText('Application')).toBeInTheDocument()
  })

  it('reveals the cold-start hint and subtle spinner after 3 seconds and keeps it visible across manual retries', async () => {
    vi.useFakeTimers()
    let rejectFirst: (error: Error) => void = () => undefined
    let resolveSecond: () => void = () => undefined
    mockedReadiness
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSecond = resolve }))

    const { container } = render(<ApiStartupGate><p>Application</p></ApiStartupGate>)

    await act(async () => { await vi.advanceTimersByTimeAsync(2999) })
    expect(screen.queryByText('Starting RepLog…')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByText('Starting RepLog…')).toBeInTheDocument()
    const spinner = container.querySelector('svg.animate-spin')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('motion-reduce:animate-none')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Current attempt|Total waiting/)).not.toBeInTheDocument()

    await act(async () => { rejectFirst(new Error('unavailable')); await Promise.resolve() })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('Starting RepLog…')).toBeInTheDocument()
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Retrying RepLog')

    await act(async () => { resolveSecond(); await Promise.resolve() })
    expect(screen.getByText('Application')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows a simplified slow-start failure card without timers or progress bars', async () => {
    mockedReadiness.mockRejectedValue(new Error('unavailable'))
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)

    const retryButton = await screen.findByRole('button', { name: 'Retry' })
    expect(retryButton).toBeInTheDocument()
    expect(retryButton).toHaveClass('min-h-11', 'min-w-11')
    expect(screen.getByRole('heading', { name: 'RepLog is starting slowly' })).toBeInTheDocument()
    expect(screen.getByText('RepLog will retry while this page is open and online.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('RepLog unavailable. Retrying automatically.')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Total waiting|Current attempt/)).not.toBeInTheDocument()
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
    expect(screen.getByRole('status')).toHaveTextContent('Offline. Reconnect to continue startup.')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Total waiting|Current attempt/)).not.toBeInTheDocument()
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

  it('keeps the simplified recovery card mounted during automatic background retry with stable announcements', async () => {
    vi.useFakeTimers()
    let rejectFirst: (error: Error) => void = () => undefined
    mockedReadiness
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<void>(() => undefined))
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(7000) })

    await act(async () => { rejectFirst(new Error('unavailable')); await Promise.resolve() })
    expect(screen.getByRole('heading', { name: 'RepLog is starting slowly' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('RepLog unavailable. Retrying automatically.')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Total waiting|Current attempt/)).not.toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { name: 'RepLog is starting slowly' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Retrying RepLog')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Total waiting|Current attempt/)).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('updates recovery announcements through an offline pause and reconnect without timers or progress bars', async () => {
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
    expect(screen.getByText('You’re offline. Reconnect to continue startup.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Offline. Reconnect to continue startup.')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Total waiting|Current attempt/)).not.toBeInTheDocument()

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    await act(async () => { window.dispatchEvent(new Event('online')); await Promise.resolve(); await Promise.resolve() })
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
    expect(screen.getByText('RepLog will retry while this page is open and online.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Retrying RepLog')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Total waiting|Current attempt/)).not.toBeInTheDocument()

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
