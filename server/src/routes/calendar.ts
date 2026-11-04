import crypto from 'node:crypto'
import { Router, type Request } from 'express'
import type { Event, PrismaClient } from '@prisma/client'
import { requireAuth, type AuthedRequest } from '../auth'
import { asyncHandler, HttpError } from '../errors'

const compactDate = (date: string) => date.replaceAll('-', '')

const compactTime = (date: string, minutes: number) => {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mins = String(minutes % 60).padStart(2, '0')
  return `${compactDate(date)}T${hours}${mins}00`
}

/** Fin de un evento: si llega justo a medianoche es las 00:00 del día siguiente. */
const endStamp = (date: string, minutes: number) => {
  if (minutes < 1440) return compactTime(date, minutes)
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return compactTime(next.toISOString().slice(0, 10), 0)
}

const escapeText = (text: string) =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')

/** RFC 5545: ninguna línea pasa de 75 bytes; las siguientes empiezan con un espacio. */
function fold(line: string) {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = Buffer.byteLength(char)
    if (bytes + size > 73) {
      out.push(current)
      current = ' '
      bytes = 1
    }
    current += char
    bytes += size
  }
  out.push(current)
  return out.join('\r\n')
}

const RRULE: Record<string, string> = {
  daily: 'FREQ=DAILY',
  weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
}

export function toIcs(events: Event[], stamp = new Date()) {
  const now = `${stamp.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MessOff//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:MessOff',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ]
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@messoff`,
      `DTSTAMP:${now}`,
      // Hora flotante: el modelo guarda la hora local, sin zona.
      `DTSTART:${compactTime(event.date, event.start)}`,
      `DTEND:${endStamp(event.date, event.start + event.duration)}`,
      `SUMMARY:${escapeText(event.title)}`,
    )
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
    if (event.note) lines.push(`DESCRIPTION:${escapeText(event.note)}`)
    const rule = RRULE[event.repeat]
    if (rule) {
      lines.push(`RRULE:${rule}${event.repeatUntil ? `;UNTIL=${compactDate(event.repeatUntil)}T235959` : ''}`)
      for (const day of event.repeatSkip) lines.push(`EXDATE:${compactTime(day, event.start)}`)
    }
    if (event.remind !== null) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(event.title)}`,
        `TRIGGER:-PT${event.remind}M`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}

const feedUrl = (req: Request, token: string) =>
  `${req.protocol}://${req.get('host')}/api/calendar/feed/${token}.ics`

export function createCalendarRouter(prisma: PrismaClient) {
  const router = Router()
  const auth = requireAuth(prisma)

  // Público a propósito: los calendarios externos no pueden iniciar sesión.
  // El token largo y revocable es la única llave.
  router.get(
    '/feed/:token.ics',
    asyncHandler(async (req, res) => {
      const token = req.params.token
      const user = token.length >= 32 ? await prisma.user.findUnique({ where: { icsToken: token } }) : null
      if (!user) throw new HttpError(404, 'Ese calendario no existe.', 'NOT_FOUND')
      const events = await prisma.event.findMany({
        where: { OR: [{ userId: user.id }, { team: { members: { some: { userId: user.id } } } }] },
        orderBy: [{ date: 'asc' }, { start: 'asc' }],
      })
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
      res.setHeader('Cache-Control', 'private, max-age=300')
      res.send(toIcs(events))
    }),
  )

  router.get(
    '/link',
    auth,
    asyncHandler(async (req, res) => {
      const { user } = req as AuthedRequest
      res.json({ url: user.icsToken ? feedUrl(req, user.icsToken) : null })
    }),
  )

  // Crear de nuevo invalida el enlace anterior.
  router.post(
    '/link',
    auth,
    asyncHandler(async (req, res) => {
      const { user } = req as AuthedRequest
      const token = crypto.randomBytes(32).toString('hex')
      await prisma.user.update({ where: { id: user.id }, data: { icsToken: token } })
      res.json({ url: feedUrl(req, token) })
    }),
  )

  router.delete(
    '/link',
    auth,
    asyncHandler(async (req, res) => {
      const { user } = req as AuthedRequest
      await prisma.user.update({ where: { id: user.id }, data: { icsToken: null } })
      res.json({ ok: true })
    }),
  )

  return router
}
