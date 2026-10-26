import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, type AuthedRequest } from '../auth'
import { asyncHandler } from '../errors'
import { toApiEvent, toApiTask, toApiUser } from '../serializers'

export function createBootstrapRouter(prisma: PrismaClient) {
  const router = Router()
  router.use(requireAuth(prisma))

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const [events, tasks] = await Promise.all([
        prisma.event.findMany({
          where: { userId: user.id },
          include: { checklist: { orderBy: { position: 'asc' } } },
          orderBy: [{ date: 'asc' }, { start: 'asc' }],
        }),
        prisma.task.findMany({
          where: { userId: user.id },
          orderBy: [{ done: 'asc' }, { due: 'asc' }, { createdAt: 'desc' }],
        }),
      ])

      res.json({
        user: toApiUser(user),
        events: events.map(toApiEvent),
        tasks: tasks.map(toApiTask),
      })
    }),
  )

  return router
}
