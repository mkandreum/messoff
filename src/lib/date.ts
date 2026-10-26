export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const WEEKDAYS_MINI = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const pad = (n: number) => String(n).padStart(2, '0')

export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d: Date, n: number) => {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

export const startOfWeek = (d: Date) => {
  const base = startOfDay(d)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  return base
}

export const isSameDay = (a: Date, b: Date) => iso(a) === iso(b)

export const isToday = (d: Date) => isSameDay(d, new Date())

export const fmtTime = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export const endOf = (start: number, duration: number) => start + duration

export const fmtRange = (start: number, duration: number) =>
  `${fmtTime(start)} – ${fmtTime(endOf(start, duration))}`

export const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  if (!rest) return `${h} h`
  return `${h} h ${rest} min`
}

export const fmtDayShort = (d: Date) => `${WEEKDAYS_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()}`

export const fmtDateLong = (d: Date) =>
  `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`

export const fmtDateMedium = (d: Date) =>
  `${WEEKDAYS_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`

export const fmtMonth = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`

export const fmtMonthShort = (d: Date) => MONTHS[d.getMonth()].slice(0, 3)

export const weekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export const weekRangeLabel = (monday: Date) => {
  const sunday = addDays(monday, 6)
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()].slice(0, 3)}`
  }
  return `${monday.getDate()} ${MONTHS[monday.getMonth()].slice(0, 3)} – ${sunday.getDate()} ${MONTHS[
    sunday.getMonth()
  ].slice(0, 3)}`
}

export const allWeekDays = (anchor: Date) => {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export const monthMatrix = (anchor: Date) => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export const nowMinutes = (d = new Date()) => d.getHours() * 60 + d.getMinutes()

export const relativeDay = (target: Date, from = new Date()) => {
  const diff = Math.round(
    (startOfDay(target).getTime() - startOfDay(from).getTime()) / 86400000,
  )
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff > 1 && diff < 7) return WEEKDAYS_SHORT[(target.getDay() + 6) % 7]
  return fmtDateMedium(target)
}

export const relativeCountdown = (date: string, start: number, now = new Date()) => {
  const target = parseISO(date)
  target.setHours(Math.floor(start / 60), start % 60, 0, 0)
  const diff = Math.round((target.getTime() - now.getTime()) / 60000)
  if (diff <= 0) return 'Ahora'
  if (diff < 60) return `en ${diff} min`
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h < 24) return `en ${h} h${m ? ` ${m} min` : ''}`
  return relativeDay(target, now)
}

export const dayNamesBetween = (a: Date, b: Date) => {
  const out: string[] = []
  let cursor = a
  while (cursor <= b) {
    out.push(iso(cursor))
    cursor = addDays(cursor, 1)
  }
  return out
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
