import { useEffect, useRef } from 'react'
import type { CalEvent } from '../types'
import { fmtRange, parseISO, relativeDay } from './date'

const FIRED_KEY = 'messoff.remindersFired'
const CHECK_EVERY = 20_000
/** Si el aviso se pasó hace más que esto (pestaña dormida), ya no se enseña. */
const LATE_LIMIT = 10 * 60_000

export const remindersSupported = () => typeof Notification !== 'undefined'

/** Hay que pedirlo desde un gesto: se llama al elegir un aviso. */
export async function askReminderPermission() {
  if (!remindersSupported() || Notification.permission !== 'default') return
  try {
    await Notification.requestPermission()
  } catch {
    /* el navegador no lo permite aquí */
  }
}

const startsAt = (event: CalEvent) => {
  const date = parseISO(event.date)
  date.setHours(Math.floor(event.start / 60), event.start % 60, 0, 0)
  return date.getTime()
}

function readFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

async function show(event: CalEvent) {
  const body = `${relativeDay(parseISO(event.date))} · ${fmtRange(event.start, event.duration)}${
    event.location ? ` · ${event.location}` : ''
  }`
  const options = { body, tag: event.id, data: { eventId: event.id } }
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) await registration.showNotification(event.title, options)
  else new Notification(event.title, options)
}

/** Avisos en la web: solo funcionan con la pestaña o la app instalada abiertas. */
export function useReminders(events: CalEvent[]) {
  const latest = useRef(events)
  latest.current = events

  useEffect(() => {
    if (!remindersSupported()) return
    const check = () => {
      if (Notification.permission !== 'granted') return
      const now = Date.now()
      const fired = readFired()
      let changed = false
      for (const event of latest.current) {
        if (event.remind === null || event.remind === undefined) continue
        const at = startsAt(event) - event.remind * 60_000
        const key = `${event.id}@${at}`
        if (at > now || now - at > LATE_LIMIT || fired[key]) continue
        fired[key] = now
        changed = true
        void show(event).catch(() => undefined)
      }
      if (changed) {
        // Lo viejo no hace falta recordarlo.
        for (const key of Object.keys(fired)) {
          if (now - fired[key] > 2 * LATE_LIMIT) delete fired[key]
        }
        try {
          localStorage.setItem(FIRED_KEY, JSON.stringify(fired))
        } catch {
          /* almacenamiento no disponible */
        }
      }
    }
    check()
    const id = window.setInterval(check, CHECK_EVERY)
    return () => window.clearInterval(id)
  }, [])
}
