import crypto from 'node:crypto'
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, type AuthedRequest } from '../auth'
import { asyncHandler, HttpError } from '../errors'
import { toApiEvent } from '../serializers'
import { eventInputSchema, eventPatchSchema, parse } from '../validation'

const uid = () => crypto.randomUUID()
const withChecklist = { checklist: { orderBy: { position: 'asc' as const } } }

export function createEventsRouter(prisma: PrismaClient) {
  const router = Router()
  router.use(requireAuth(prisma))

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const events = await prisma.event.findMany({
        where: { userId: user.id },
        include: withChecklist,
        orderBy: [{ date: 'asc' }, { start: 'asc' }],
      })
      res.json({ events: events.map(toApiEvent) })
    }),
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const body = parse(eventInputSchema, req.body)
      const { checklist = [], ...event } = body
      try {
        const created = await prisma.event.create({
          data: {
            id: event.id ?? uid(),
            userId: user.id,
            title: event.title,
            date: event.date,
            start: event.start,
            duration: event.duration,
            category: event.category ?? 'trabajo',
            location: event.location ?? '',
            note: event.note ?? '',
            attendees: event.attendees ?? [],
            checklist: {
              create: checklist.map((item, index) => ({
                id: item.id ?? uid(),
                text: item.text,
                done: item.done ?? false,
                position: index,
              })),
            },
          },
          include: withChecklist,
        })
        res.status(201).json({ event: toApiEvent(created) })
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new HttpError(409, 'Ese evento ya existe.', 'EVENT_EXISTS')
        }
        throw error
      }
    }),
  )

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const body = parse(eventPatchSchema, req.body)
      const existing = await prisma.event.findFirst({
        where: { id: req.params.id, userId: user.id },
      })
      if (!existing) throw new HttpError(404, 'Ese evento no existe.', 'NOT_FOUND')

      const nextStart = body.start ?? existing.start
      const nextDuration = body.duration ?? existing.duration
      if (nextStart + nextDuration > 1440) {
        throw new HttpError(400, 'El evento no puede terminar después de medianoche.', 'VALIDATION')
      }

      const { checklist, ...fields } = body
      const updated = await prisma.event.update({
        where: { id: existing.id },
        data: {
          ...fields,
          ...(checklist
            ? {
                checklist: {
                  deleteMany: {},
                  create: checklist.map((item, index) => ({
                    id: item.id ?? uid(),
                    text: item.text,
                    done: item.done ?? false,
                    position: index,
                  })),
                },
              }
            : {}),
        },
        include: withChecklist,
      })

      res.json({ event: toApiEvent(updated) })
    }),
  )

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const result = await prisma.event.deleteMany({
        where: { id: req.params.id, userId: user.id },
      })
      if (result.count === 0) throw new HttpError(404, 'Ese evento no existe.', 'NOT_FOUND')
      res.json({ ok: true })
    }),
  )

  router.post(
    '/:id/duplicate',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const source = await prisma.event.findFirst({
        where: { id: req.params.id, userId: user.id },
        include: withChecklist,
      })
      if (!source) throw new HttpError(404, 'Ese evento no existe.', 'NOT_FOUND')

      const copy = await prisma.event.create({
        data: {
          id: uid(),
          userId: user.id,
          title: `${source.title} (copia)`,
          date: source.date,
          start: source.start,
          duration: source.duration,
          category: source.category,
          location: source.location,
          note: source.note,
          attendees: source.attendees,
          checklist: {
            create: source.checklist.map((item, index) => ({
              id: uid(),
              text: item.text,
              done: false,
              position: index,
            })),
          },
        },
        include: withChecklist,
      })

      res.status(201).json({ event: toApiEvent(copy) })
    }),
  )

  return router
}
