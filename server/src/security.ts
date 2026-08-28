import type { NextFunction, Request, Response } from 'express'
import { env } from './env.js'
import { readAuthCookie } from './modules/auth/auth.tokens.js'

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const allowedFetchSites = new Set(['same-origin', 'same-site'])

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map(Number)

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false
  }

  const [first, second] = octets

  if (first === undefined || second === undefined) {
    return false
  }

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isAllowedDevelopmentOrigin(origin: string) {
  try {
    const url = new URL(origin)
    const hostname = url.hostname.toLowerCase()

    if (url.protocol !== 'http:' || url.port !== '5173') {
      return false
    }

    return hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || isPrivateIpv4(hostname)
  } catch {
    return false
  }
}

export function isAllowedOrigin(origin: string) {
  return origin === env.CLIENT_URL || (env.NODE_ENV !== 'production' && isAllowedDevelopmentOrigin(origin))
}

export function isApiPath(path: string) {
  return path === '/api' || path.startsWith('/api/')
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
  )

  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  next()
}

export function noStoreApiResponses(req: Request, res: Response, next: NextFunction) {
  if (isApiPath(req.path)) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
  }

  next()
}

export function requireExpectedOrigin(req: Request, res: Response, next: NextFunction) {
  if (!unsafeMethods.has(req.method) || !readAuthCookie(req.cookies ?? {})) {
    next()
    return
  }

  const origin = req.get('origin')
  const fetchSite = req.get('sec-fetch-site')?.toLowerCase()
  const hasAllowedOrigin = origin !== undefined && isAllowedOrigin(origin)
  const hasAllowedFetchMetadata = fetchSite !== undefined && allowedFetchSites.has(fetchSite)

  if ((origin !== undefined && !hasAllowedOrigin) || (fetchSite !== undefined && !hasAllowedFetchMetadata)) {
    res.status(403).json({ error: 'Request origin is not allowed' })
    return
  }

  if (hasAllowedOrigin || hasAllowedFetchMetadata || env.NODE_ENV !== 'production') {
    next()
    return
  }

  res.status(403).json({ error: 'Request origin is not allowed' })
}
