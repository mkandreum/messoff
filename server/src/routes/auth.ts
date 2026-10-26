import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { config } from '../env'
import { asyncHandler, HttpError } from '../errors'
import {
  authLimiter,
  checkPassword,
  clearSessionCookie,
  hashPassword,
  normalizeEmail,
  requireAuth,
  setSessionCookie,
  type AuthedRequest,
} from '../auth'
import { seedWorkspace } from '../seed'
import { toApiUser } from '../serializers'
import {
  deleteAccountSchema,
  loginSchema,
  parse,
  passwordSchema,
  profileSchema,
  registerSchema,
} from '../validation'

export function createAuthRouter(prisma: PrismaClient) {
  const router = Router()

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.post(
    '/register',
    authLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(registerSchema, req.body)
      const email = normalizeEmail(body.email)

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        throw new HttpError(409, 'Ese email ya tiene una cuenta. Prueba a entrar.', 'EMAIL_TAKEN')
      }

      const passwordHash = await hashPassword(body.password)
      let user
      try {
        user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email,
              name: body.name.replace(/\s+/g, ' ').trim(),
              passwordHash,
            },
          })
          if (config.seedDemo) await seedWorkspace(tx, created.id)
          return created
        })
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new HttpError(409, 'Ese email ya tiene una cuenta. Prueba a entrar.', 'EMAIL_TAKEN')
        }
        throw error
      }

      setSessionCookie(res, user)
      res.status(201).json({ user: toApiUser(user) })
    }),
  )

  router.post(
    '/login',
    authLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(loginSchema, req.body)
      const email = normalizeEmail(body.email)
      const user = await prisma.user.findUnique({ where: { email } })

      if (!(await checkPassword(user, body.password))) {
        throw new HttpError(401, 'Email o contraseña incorrectos.', 'BAD_CREDENTIALS')
      }

      setSessionCookie(res, user!)
      res.json({ user: toApiUser(user!) })
    }),
  )

  router.post(
    '/logout',
    asyncHandler(async (_req, res) => {
      clearSessionCookie(res)
      res.json({ ok: true })
    }),
  )

  router.get(
    '/me',
    requireAuth(prisma),
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      res.json({ user: toApiUser(user) })
    }),
  )

  router.patch(
    '/me',
    requireAuth(prisma),
    asyncHandler(async (req, res) => {
      const current = (req as AuthedRequest).user
      const body = parse(profileSchema, req.body)
      const user = await prisma.user.update({
        where: { id: current.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.replace(/\s+/g, ' ').trim() } : {}),
          ...(body.theme !== undefined ? { theme: body.theme } : {}),
          ...(body.haptics !== undefined ? { haptics: body.haptics } : {}),
        },
      })
      res.json({ user: toApiUser(user) })
    }),
  )

  router.patch(
    '/password',
    requireAuth(prisma),
    asyncHandler(async (req, res) => {
      const current = (req as AuthedRequest).user
      const body = parse(passwordSchema, req.body)
      if (!(await checkPassword(current, body.currentPassword))) {
        throw new HttpError(400, 'La contraseña actual no es correcta.', 'BAD_PASSWORD')
      }
      const user = await prisma.user.update({
        where: { id: current.id },
        data: {
          passwordHash: await hashPassword(body.newPassword),
          tokenVersion: { increment: 1 },
        },
      })
      setSessionCookie(res, user)
      res.json({ user: toApiUser(user) })
    }),
  )

  router.post(
    '/logout-all',
    requireAuth(prisma),
    asyncHandler(async (req, res) => {
      const current = (req as AuthedRequest).user
      await prisma.user.update({
        where: { id: current.id },
        data: { tokenVersion: { increment: 1 } },
      })
      clearSessionCookie(res)
      res.json({ ok: true })
    }),
  )

  router.post(
    '/delete',
    requireAuth(prisma),
    asyncHandler(async (req, res) => {
      const current = (req as AuthedRequest).user
      const body = parse(deleteAccountSchema, req.body)
      if (!(await checkPassword(current, body.password))) {
        throw new HttpError(400, 'La contraseña no es correcta.', 'BAD_PASSWORD')
      }
      await prisma.user.delete({ where: { id: current.id } })
      clearSessionCookie(res)
      res.json({ ok: true })
    }),
  )

  return router
}
