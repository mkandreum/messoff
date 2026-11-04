import type { CalEvent, RepeatRule } from '../types'

const SEPARATOR = '__'

export const REPEAT_OPTIONS: { id: RepeatRule; label: string }[] = [
  { id: 'none', label: 'No se repite' },
  { id: 'daily', label: 'Cada día' },
  { id: 'weekdays', label: 'De lunes a viernes' },
  { id: 'weekly', label: 'Cada semana' },
  { id: 'monthly', label: 'Cada mes' },
]

export const REMIND_OPTIONS: { minutes: number | null; label: string }[] = [
  { minutes: null, label: 'Sin aviso' },
  { minutes: 0, label: 'Al empezar' },
  { minutes: 5, label: '5 min' },
  { minutes: 10, label: '10 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 1440, label: '1 día' },
]

const toUtc = (day: string) => new Date(`${day}T00:00:00Z`)
const toDay = (date: Date) => date.toISOString().slice(0, 10)

export const shiftDay = (day: string, days: number) => {
  const date = toUtc(day)
  date.setUTCDate(date.getUTCDate() + days)
  return toDay(date)
}

export const daysBetween = (from: string, to: string) =>
  Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)

export const isRepeating = (event: Pick<CalEvent, 'repeat'>) => !!event.repeat && event.repeat !== 'none'

/** Una serie es una sola fila: la primera aparición conserva su id y las demás son "serie__fecha". */
export const seriesId = (id: string) => id.split(SEPARATOR)[0]

export const occurrenceDate = (id: string) => (id.includes(SEPARATOR) ? id.split(SEPARATOR)[1] : null)

export const occurrenceId = (series: string, day: string, first: string) =>
  day === first ? series : `${series}${SEPARATOR}${day}`

/** Las fechas de la serie entre dos días, ambos incluidos. */
export function seriesDates(event: CalEvent, from: string, to: string): string[] {
  if (!isRepeating(event)) return event.date >= from && event.date <= to ? [event.date] : []
  const last = event.repeatUntil && event.repeatUntil < to ? event.repeatUntil : to
  const skip = event.repeatSkip ?? []
  const out: string[] = []
  const add = (day: string) => {
    if (day >= from && !skip.includes(day)) out.push(day)
  }
  if (event.repeat === 'daily' || event.repeat === 'weekdays') {
    for (let day = event.date < from ? from : event.date; day <= last; day = shiftDay(day, 1)) {
      const dow = toUtc(day).getUTCDay()
      if (event.repeat === 'daily' || (dow !== 0 && dow !== 6)) add(day)
    }
  } else if (event.repeat === 'weekly') {
    const weeks = event.date < from ? Math.floor(daysBetween(event.date, from) / 7) : 0
    for (let day = shiftDay(event.date, weeks * 7); day <= last; day = shiftDay(day, 7)) add(day)
  } else if (event.repeat === 'monthly') {
    const first = toUtc(event.date)
    const dayOfMonth = first.getUTCDate()
    for (let step = 0; ; step += 1) {
      const candidate = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + step, dayOfMonth))
      const day = toDay(candidate)
      if (day > last) break
      // Un día 31 no aparece en los meses que no lo tienen.
      if (candidate.getUTCDate() === dayOfMonth) add(day)
    }
  }
  return out
}

/** Sustituye cada serie por sus apariciones dentro de la ventana. */
export function expandEvents(events: CalEvent[], from: string, to: string): CalEvent[] {
  return events.flatMap((event) =>
    isRepeating(event)
      ? seriesDates(event, from, to).map((day) => ({
          ...event,
          id: occurrenceId(event.id, day, event.date),
          date: day,
        }))
      : [event],
  )
}

export type Placement = { column: number; columns: number }

/** Reparte los eventos solapados de un día en columnas, lado a lado. */
export function layoutDay(events: CalEvent[]): Map<string, Placement> {
  const MIN_VISUAL = 20
  const out = new Map<string, Placement>()
  let cluster: { id: string; column: number }[] = []
  let ends: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const item of cluster) out.set(item.id, { column: item.column, columns: ends.length })
    cluster = []
    ends = []
  }
  const sorted = [...events].sort((a, b) => a.start - b.start || b.duration - a.duration)
  for (const event of sorted) {
    if (event.start >= clusterEnd) {
      flush()
      clusterEnd = -1
    }
    const end = event.start + Math.max(event.duration, MIN_VISUAL)
    let column = ends.findIndex((value) => value <= event.start)
    if (column < 0) {
      column = ends.length
      ends.push(end)
    } else {
      ends[column] = end
    }
    cluster.push({ id: event.id, column })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()
  return out
}
