import crypto from 'node:crypto'
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, type AuthedRequest } from '../auth'
import { asyncHandler, HttpError } from '../errors'
import { toApiSession } from '../serializers'
import { DATE_RE, focusSessionSchema, parse } from '../validation'

export function createFocusRouter(prisma: PrismaClient) {
  const router = Router()
  router.use(requireAuth(prisma))

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const date =
        typeof req.query.date === 'string' && DATE_RE.test(req.query.date)
          ? req.query.date
          : new Intl.DateTimeFormat('en-CA', {
              timeZone: process.env.TZ || 'Europe/Madrid',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date())

      const start = new Date(`${date}T00:00:00`)
      if (Number.isNaN(start.getTime())) throw new HttpError(400, 'Fecha no válida', 'VALIDATION')
      const end = new Date(start)
      end.setDate(end.getDate() + 1)

      const sessions = await prisma.focusSession.findMany({
        where: { userId: user.id, completedAt: { gte: start, lt: end } },
        orderBy: { completedAt: 'desc' },
      })
      res.json({ sessions: sessions.map(toApiSession) })
    }),
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const body = parse(focusSessionSchema, req.body)
      const session = await prisma.focusSession.create({
        data: { id: crypto.randomUUID(), userId: user.id, minutes: body.minutes },
      })
      res.status(201).json({ session: toApiSession(session) })
    }),
  )

  return router
}
