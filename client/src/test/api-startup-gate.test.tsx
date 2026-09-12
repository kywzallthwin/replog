import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiStartupGate } from '../components/startup/ApiStartupGate'
import { waitForApiReadiness } from '../lib/apiReadiness'

vi.mock('../lib/apiReadiness', () => ({ waitForApiReadiness: vi.fn() }))
const mockedReadiness = vi.mocked(waitForApiReadiness)

describe('ApiStartupGate', () => {
  beforeEach(() => {
    mockedReadiness.mockReset().mockReturnValue(new Promise<void>(() => undefined))
  })

  it('holds children until readiness succeeds', async () => {
    let resolve: () => void = () => undefined
    mockedReadiness.mockReturnValue(new Promise<void>((done) => { resolve = done }))
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    expect(screen.getByRole('status')).toHaveTextContent('Starting RepLog...')
    resolve()
    expect(await screen.findByText('Application')).toBeInTheDocument()
  })

  it('shows a bounded failure state', async () => {
    mockedReadiness.mockRejectedValue(new Error('unavailable'))
    render(<ApiStartupGate><p>Application</p></ApiStartupGate>)
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('Application')).not.toBeInTheDocument()
  })

  it('shows a configuration error without checking readiness', () => {
    render(<ApiStartupGate configurationError={new Error('invalid URL')}><p>Application</p></ApiStartupGate>)
    expect(screen.getByRole('heading', { name: 'RepLog could not start' })).toBeInTheDocument()
    expect(screen.getByText(/API URL is not configured correctly/)).toBeInTheDocument()
    expect(mockedReadiness).not.toHaveBeenCalled()
  })
})
