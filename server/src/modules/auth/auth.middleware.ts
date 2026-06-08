import type { NextFunction, Request, Response } from 'express'
import { readAuthCookie, verifyAuthToken } from './auth.tokens.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readAuthCookie(req.cookies ?? {})

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const payload = verifyAuthToken(token)

    if (!payload) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Authentication required' })
  }
}
