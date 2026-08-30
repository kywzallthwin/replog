import type { ImgHTMLAttributes } from 'react'

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src'> & {
  alt?: string
  compact?: boolean
  inverse?: boolean
}

export function BrandLogo({
  alt = 'RepLog',
  className = 'h-8 w-auto',
  compact = false,
  inverse = false,
  ...props
}: BrandLogoProps) {
  const logoName = compact ? 'replog-logo-mark' : 'replog-logo'
  const tone = inverse ? '-inverse' : ''

  return <img {...props} src={`/brand/${logoName}${tone}.svg`} alt={alt} className={className} />
}
