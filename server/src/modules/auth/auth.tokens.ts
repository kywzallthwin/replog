import type { CookieOptions, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../env.js'

const authCookieName = 'replog_token'
const authCookieMaxAgeMs = 1000 * 60 * 60 * 24 * 7

const authCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

type AuthTokenPayload = {
  userId: string
  authVersion: number
}

export function setAuthCookie(res: Response, userId: string, authVersion: number) {
  const token = jwt.sign({ userId, authVersion } satisfies AuthTokenPayload, env.JWT_SECRET, {
    expiresIn: '7d',
  })

  res.cookie(authCookieName, token, {
    ...authCookieOptions,
    maxAge: authCookieMaxAgeMs,
  })
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(authCookieName, authCookieOptions)
}

export function readAuthCookie(cookies: Record<string, unknown>) {
  const token = cookies[authCookieName]
  return typeof token === 'string' ? token : null
}

export function verifyAuthToken(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET)

  if (
    typeof payload === 'string' ||
    typeof payload.userId !== 'string' ||
    typeof payload.authVersion !== 'number'
  ) {
    return null
  }

  return { userId: payload.userId, authVersion: payload.authVersion }
}
