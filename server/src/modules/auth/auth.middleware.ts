import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../../prisma.js'
import { readAuthCookie, verifyAuthToken } from './auth.tokens.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { authVersion: true },
    })

    if (!user || user.authVersion !== payload.authVersion) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Authentication required' })
  }
}
