import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { PrismaClient, User } from '@prisma/client'
import { config } from './env'
import { HttpError } from './errors'

export type AuthedRequest = Request & { user: User }

export const normalizeEmail = (value: string) => value.trim().toLowerCase()

export const hashPassword = (password: string) => bcrypt.hash(password, 12)

const DUMMY_HASH = bcrypt.hashSync('pulso-dummy-password', 12)

export async function checkPassword(user: User | null, password: string) {
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH)
  return Boolean(user?.passwordHash) && ok
}

export function signSession(user: Pick<User, 'id' | 'tokenVersion'>) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.sessionDays * 24 * 60 * 60,
  })
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
})

export function setSessionCookie(res: Response, user: Pick<User, 'id' | 'tokenVersion'>) {
  res.cookie(config.cookieName, signSession(user), cookieOptions())
}

export function clearSessionCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions()
  res.clearCookie(config.cookieName, options)
}

function readToken(req: Request) {
  const header = req.header('authorization') || ''
  const [kind, bearer] = header.split(' ')
  if (/^Bearer$/i.test(kind) && bearer) {
    return { token: bearer, cookie: false }
  }
  const cookie = req.cookies?.[config.cookieName]
  if (typeof cookie === 'string' && cookie) {
    return { token: cookie, cookie: true }
  }
  return { token: null, cookie: false }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function assertMutationIsSafe(req: Request, fromCookie: boolean) {
  if (SAFE_METHODS.has(req.method) || !fromCookie) return
  if (req.header('x-requested-with') !== 'XMLHttpRequest') {
    throw new HttpError(403, 'Petición no permitida', 'CSRF')
  }
}

export const requireAuth =
  (prisma: PrismaClient): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { token, cookie } = readToken(req)
      if (!token) {
        throw new HttpError(401, 'Inicia sesión para continuar', 'NO_TOKEN')
      }

      let payload: jwt.JwtPayload
      try {
        payload = jwt.verify(token, config.jwtSecret, {
          algorithms: ['HS256'],
        }) as jwt.JwtPayload
      } catch {
        throw new HttpError(401, 'Tu sesión ha caducado. Vuelve a entrar.', 'INVALID_TOKEN')
      }

      const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } })
      if (!user || (Number(payload.tv) || 0) !== user.tokenVersion) {
        throw new HttpError(401, 'Tu sesión ha caducado. Vuelve a entrar.', 'SESSION_REVOKED')
      }

      assertMutationIsSafe(req, cookie)
      ;(req as AuthedRequest).user = user
      next()
    } catch (error) {
      next(error)
    }
  }

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
      code: 'RATE_LIMITED',
    })
  },
})

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 400,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Vas demasiado rápido. Espera un momento.',
      code: 'RATE_LIMITED',
    })
  },
})
