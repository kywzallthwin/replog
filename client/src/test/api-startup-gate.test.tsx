import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiStartupGate } from '../components/startup/ApiStartupGate'
import { waitForApiReadiness } from '../lib/apiReadiness'

vi.mock('../lib/apiReadiness', () => ({ waitForApiReadiness: vi.fn() }))

const mockedReadiness = vi.mocked(waitForApiReadiness)

describe('ApiStartupGate', () => {
  beforeEach(() => {
    mockedReadiness.mockReset()
    mockedReadiness.mockReturnValue(new Promise<void>(() => undefined))
  })

  it('keeps children hidden until readiness succeeds', async () => {
    let resolve: () => void = () => undefined
    mockedReadiness.mockReturnValue(new Promise<void>((done) => { resolve = done }))
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)

    expect(screen.getByRole('status')).toHaveTextContent('Starting RepLog...')
    expect(screen.queryByText('Application')).not.toBeInTheDocument()
    resolve()
    expect(await screen.findByText('Application')).toBeInTheDocument()
  })

  it('shows a retry action after failure and starts a fresh run', async () => {
    mockedReadiness.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(undefined)
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Application')).toBeInTheDocument()
    expect(mockedReadiness).toHaveBeenCalledTimes(2)
  })

  it('aborts readiness when unmounted', async () => {
    const { unmount } = render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    const options = mockedReadiness.mock.calls[0]?.[0]
    unmount()
    await waitFor(() => expect(options?.signal?.aborted).toBe(true))
  })
})
