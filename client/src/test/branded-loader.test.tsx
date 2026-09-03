import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandedLoader } from '../components/ui/BrandedLoader'
import { PageLoader } from '../components/ui/PageLoader'

describe('branded loading treatment', () => {
  it('exposes a polite status and animates the three parts of the RepLog mark', () => {
    const { container } = render(<BrandedLoader statusMessage="Loading dashboard..." />)

    expect(screen.getByRole('status', { name: 'Loading dashboard...' })).toHaveAttribute(
      'aria-live',
      'polite',
    )
    expect(container.querySelectorAll('[data-loader-bar]')).toHaveLength(3)
    expect(container.querySelector('[data-loader-monogram]')).toBeInTheDocument()
    expect(screen.queryByText('RepLog')).not.toBeInTheDocument()
  })

  it('uses the full-screen brand lockup for auth gates', () => {
    const { container } = render(<BrandedLoader fullScreen statusMessage="Loading RepLog..." />)

    expect(screen.getByText('RepLog')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading RepLog...' })).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('min-h-dvh', 'place-content-center')
  })

  it('forwards page-specific status text through the loading card', () => {
    const { container } = render(<PageLoader statusMessage="Loading history..." />)

    expect(screen.getByRole('status', { name: 'Loading history...' })).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('min-h-[250px]')
  })
})
