import crypto from 'node:crypto'
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, type AuthedRequest } from '../auth'
import { asyncHandler, HttpError } from '../errors'
import { eventInclude, toApiEvent, toApiTask } from '../serializers'
import { addDays, today } from '../seed'
import { parse, scheduleSchema, taskInputSchema, taskPatchSchema } from '../validation'

const uid = () => crypto.randomUUID()
const withChecklist = eventInclude
const SLOT_MINUTES = 45
const DAY_START = 9 * 60
const DAY_END = 20 * 60
const STEP = 30
const BUFFER = 15

export function createTasksRouter(prisma: PrismaClient) {
  const router = Router()
  router.use(requireAuth(prisma))

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const tasks = await prisma.task.findMany({
        where: { userId: user.id },
        orderBy: [{ done: 'asc' }, { due: 'asc' }, { createdAt: 'desc' }],
      })
      res.json({ tasks: tasks.map(toApiTask) })
    }),
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const body = parse(taskInputSchema, req.body)
      try {
        const task = await prisma.task.create({
          data: {
            id: body.id ?? uid(),
            userId: user.id,
            title: body.title,
            due: body.due ?? null,
            tag: body.tag ?? 'personal',
            done: body.done ?? false,
          },
        })
        res.status(201).json({ task: toApiTask(task) })
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new HttpError(409, 'Esa tarea ya existe.', 'TASK_EXISTS')
        }
        throw error
      }
    }),
  )

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const body = parse(taskPatchSchema, req.body)
      const existing = await prisma.task.findFirst({
        where: { id: req.params.id, userId: user.id },
      })
      if (!existing) throw new HttpError(404, 'Esa tarea no existe.', 'NOT_FOUND')

      const task = await prisma.task.update({
        where: { id: existing.id },
        data: body,
      })
      res.json({ task: toApiTask(task) })
    }),
  )

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const result = await prisma.task.deleteMany({
        where: { id: req.params.id, userId: user.id },
      })
      if (result.count === 0) throw new HttpError(404, 'Esa tarea no existe.', 'NOT_FOUND')
      res.json({ ok: true })
    }),
  )

  router.post(
    '/:id/schedule',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const body = parse(scheduleSchema, req.body)
      const task = await prisma.task.findFirst({
        where: { id: req.params.id, userId: user.id },
      })
      if (!task) throw new HttpError(404, 'Esa tarea no existe.', 'NOT_FOUND')
      if (task.done) {
        throw new HttpError(409, 'Esa tarea ya está programada.', 'TASK_DONE')
      }

      const day = today()
      const firstDay = body.date ?? (task.due && task.due >= day ? task.due : day)

      for (let offset = 0; offset < 14; offset += 1) {
        const date = addDays(firstDay, offset)
        const existing = await prisma.event.findMany({
          where: { userId: user.id, date },
          select: { start: true, duration: true },
        })

        for (let start = DAY_START; start + SLOT_MINUTES <= DAY_END; start += STEP) {
          const overlaps = existing.some(
            (event) =>
              start < event.start + event.duration + BUFFER &&
              start + SLOT_MINUTES + BUFFER > event.start - BUFFER,
          )
          if (overlaps) continue

          const event = await prisma.event.create({
            data: {
              id: uid(),
              userId: user.id,
              title: task.title,
              date,
              start,
              duration: SLOT_MINUTES,
              category: task.tag,
              location: 'Desde la bandeja',
            },
            include: withChecklist,
          })
          const updatedTask = await prisma.task.update({
            where: { id: task.id },
            data: { done: true },
          })
          return res.status(201).json({
            event: toApiEvent(event),
            task: toApiTask(updatedTask),
          })
        }
      }

      throw new HttpError(
        409,
        'No hay hueco libre en los próximos 14 días. Mueve algo primero.',
        'NO_SLOT',
      )
    }),
  )

  return router
}
