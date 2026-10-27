import crypto from 'node:crypto'
import type { Prisma } from '@prisma/client'

const uid = () => crypto.randomUUID()

function todayInMadrid() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TZ || 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day, 12))
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function today() {
  return todayInMadrid()
}

type DemoEvent = {
  title: string
  date: string
  start: number
  duration: number
  category: string
  location?: string
  note?: string
  attendees?: string[]
  checklist?: { text: string; done?: boolean }[]
}

export async function seedWorkspace(tx: Prisma.TransactionClient, userId: string) {
  const base = today()

  // Solo dos eventos de guía: el resto del calendario empieza vacío.
  const events: DemoEvent[] = [
    {
      title: 'Bienvenido a MessOff',
      date: base,
      start: 9 * 60 + 30,
      duration: 60,
      category: 'trabajo',
      location: 'Tu escritorio',
      note: 'Este es un evento de ejemplo. Edítalo o bórralo cuando quieras.',
      checklist: [
        { text: 'Mover esta tarjeta a otro día', done: false },
        { text: 'Crear tu primer evento real', done: false },
      ],
    },
    {
      title: 'Cómo usar MessOff',
      date: addDays(base, 1),
      start: 10 * 60,
      duration: 45,
      category: 'personal',
      location: 'Guía rápida',
      note: 'Toca un hueco del calendario para crear un evento. Mantén pulsado un evento para moverlo. Desliza una tarea a la derecha para completarla. Crea un equipo para compartir calendario.',
      checklist: [
        { text: 'Escribir un evento en lenguaje natural (“Café con Lucía mañana 09:30”)', done: false },
        { text: 'Cambiar de vista: Día, Semana, Agenda o Mes', done: false },
        { text: 'Crear un equipo e invitar a alguien', done: false },
      ],
    },
  ]

  for (const event of events) {
    await tx.event.create({
      data: {
        id: uid(),
        userId,
        title: event.title,
        date: event.date,
        start: event.start,
        duration: event.duration,
        category: event.category,
        location: event.location ?? '',
        note: event.note ?? '',
        attendees: event.attendees ?? [],
        checklist: {
          create: (event.checklist ?? []).map((item, index) => ({
            id: uid(),
            text: item.text,
            done: item.done ?? false,
            position: index,
          })),
        },
      },
    })
  }

  await tx.task.createMany({
    data: [
      {
        id: uid(),
        userId,
        title: 'Crear tu primer evento real',
        due: base,
        tag: 'trabajo',
      },
      {
        id: uid(),
        userId,
        title: 'Probar a arrastrar una tarjeta',
        due: addDays(base, 1),
        tag: 'personal',
      },
      {
        id: uid(),
        userId,
        title: 'Revisar tus ajustes',
        due: addDays(base, 2),
        tag: 'personal',
      },
    ],
  })
}
