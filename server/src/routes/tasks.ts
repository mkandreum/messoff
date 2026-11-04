import crypto from 'node:crypto'
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, type AuthedRequest } from '../auth'
import { asyncHandler, HttpError } from '../errors'
import { eventInclude, taskInclude, toApiEvent, toApiTask } from '../serializers'
import { occursOn } from '../recurrence'
import { addDays, today } from '../seed'
import { parse, scheduleSchema, taskInputSchema, taskPatchSchema } from '../validation'

const uid = () => crypto.randomUUID()
const withChecklist = eventInclude
const SLOT_MINUTES = 45
const DAY_START = 9 * 60
const DAY_END = 20 * 60
const STEP = 30
const BUFFER = 15

/** Tareas propias o de equipos de los que formo parte. */
const accessible = (userId: string) => ({
  OR: [{ userId }, { team: { members: { some: { userId } } } }],
})

export function createTasksRouter(prisma: PrismaClient) {
  const router = Router()
  router.use(requireAuth(prisma))

  async function assertMember(teamId: string, userId: string, message: string) {
    const member = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } })
    if (!member) throw new HttpError(403, message, 'FORBIDDEN')
  }

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const tasks = await prisma.task.findMany({
        where: accessible(user.id),
        include: taskInclude,
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
      const teamId = body.teamId ?? null
      const assigneeId = teamId ? (body.assigneeId ?? null) : null
      if (teamId) await assertMember(teamId, user.id, 'No formas parte de ese equipo.')
      if (teamId && assigneeId) await assertMember(teamId, assigneeId, 'Esa persona no está en el equipo.')
      try {
        const task = await prisma.task.create({
          data: {
            id: body.id ?? uid(),
            userId: user.id,
            title: body.title,
            due: body.due ?? null,
            tag: body.tag ?? 'personal',
            done: body.status ? body.status === 'done' : (body.done ?? false),
            status: body.status ?? (body.done ? 'done' : 'todo'),
            teamId,
            assigneeId,
          },
          include: taskInclude,
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
        where: { id: req.params.id, ...accessible(user.id) },
      })
      if (!existing) throw new HttpError(404, 'Esa tarea no existe.', 'NOT_FOUND')

      const teamId = body.teamId === undefined ? existing.teamId : body.teamId
      if (teamId !== existing.teamId) {
        // Solo quien la creó decide dónde vive la tarea.
        if (existing.userId !== user.id) {
          throw new HttpError(403, 'Solo quien creó la tarea puede cambiarla de sitio.', 'FORBIDDEN')
        }
        if (teamId) await assertMember(teamId, user.id, 'No formas parte de ese equipo.')
      }
      // Sin equipo no hay a quién asignarla; al cambiar de equipo la asignación no se hereda.
      let assigneeId = body.assigneeId === undefined ? existing.assigneeId : body.assigneeId
      if (!teamId || (teamId !== existing.teamId && body.assigneeId === undefined)) assigneeId = null
      if (teamId && assigneeId) await assertMember(teamId, assigneeId, 'Esa persona no está en el equipo.')

      // El estado manda; quien solo cambia `done` lo mueve entre pendiente y hecha.
      const stateFields = body.status
        ? { status: body.status, done: body.status === 'done' }
        : body.done === undefined
          ? {}
          : {
              done: body.done,
              status: body.done ? 'done' : existing.status === 'done' ? 'todo' : existing.status,
            }

      const task = await prisma.task.update({
        where: { id: existing.id },
        data: { ...body, ...stateFields, teamId, assigneeId },
        include: taskInclude,
      })
      res.json({ task: toApiTask(task) })
    }),
  )

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user
      const result = await prisma.task.deleteMany({
        where: { id: req.params.id, ...accessible(user.id) },
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
        where: { id: req.params.id, ...accessible(user.id) },
      })
      if (!task) throw new HttpError(404, 'Esa tarea no existe.', 'NOT_FOUND')
      if (task.done) {
        throw new HttpError(409, 'Esa tarea ya está programada.', 'TASK_DONE')
      }

      const day = today()
      const firstDay = body.date ?? (task.due && task.due >= day ? task.due : day)

      for (let offset = 0; offset < 14; offset += 1) {
        const date = addDays(firstDay, offset)
        const candidates = await prisma.event.findMany({
          where: { userId: user.id, OR: [{ date }, { repeat: { not: 'none' }, date: { lte: date } }] },
          select: { date: true, start: true, duration: true, repeat: true, repeatUntil: true, repeatSkip: true },
        })
        const existing = candidates.filter((event) => occursOn(event, date))

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
              // Una tarea de equipo se programa en el calendario del equipo.
              teamId: task.teamId,
            },
            include: withChecklist,
          })
          const updatedTask = await prisma.task.update({
            where: { id: task.id },
            data: { done: true, status: 'done' },
            include: taskInclude,
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
