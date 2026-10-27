import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, type AuthedRequest } from '../auth'
import { asyncHandler } from '../errors'
import { eventInclude, toApiEvent, toApiTask, toApiUser } from '../serializers'
import { loadTeams } from './teams'

export function createBootstrapRouter(prisma: PrismaClient) {
  const router = Router()
  router.use(requireAuth(prisma))

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const [events, tasks, teams] = await Promise.all([
        prisma.event.findMany({
          where: {
            OR: [{ userId: user.id }, { team: { members: { some: { userId: user.id } } } }],
          },
          include: eventInclude,
          orderBy: [{ date: 'asc' }, { start: 'asc' }],
        }),
        prisma.task.findMany({
          where: { userId: user.id },
          orderBy: [{ done: 'asc' }, { due: 'asc' }, { createdAt: 'desc' }],
        }),
        loadTeams(prisma, user),
      ])

      res.json({
        user: toApiUser(user),
        events: events.map(toApiEvent),
        tasks: tasks.map(toApiTask),
        ...teams,
      })
    }),
  )

  return router
}
