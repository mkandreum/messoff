import type { Category } from '../types'
import { addDays, iso, startOfDay } from './date'

const WEEKDAY_WORDS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miércoles: 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  sabado: 6,
}

const CATEGORY_WORDS: { words: string[]; category: Category }[] = [
  { words: ['comida', 'cena', 'café', 'cafe', 'cerveza', 'caña', 'cumpleaños', 'concierto', 'cine', 'brunch'], category: 'social' },
  { words: ['gimnasio', 'yoga', 'correr', 'médico', 'medico', 'dentista', 'analítica', 'analitica', 'fisio', 'paseo'], category: 'salud' },
  { words: ['reunión', 'reunion', 'llamada', 'demo', 'cliente', 'producto', 'entrevista', 'propuesta', 'equipo', 'okr'], category: 'trabajo' },
]

const guessCategory = (text: string): Category | null => {
  const lower = text.toLowerCase()
  for (const entry of CATEGORY_WORDS) {
    if (entry.words.some((word) => lower.includes(word))) return entry.category
  }
  return null
}

export type ParsedEvent = {
  title: string
  date: string
  start: number
  duration: number
  category: Category | null
  matchedDay: boolean
  matchedTime: boolean
}

const MONTH_WORDS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Palabra completa, también con acentos y eñes (\\b no los entiende). */
const word = (source: string) => new RegExp(`(?<![\\p{L}\\d])${source}(?![\\p{L}\\d])`, 'iu')

const atDay = (day: number, month: number, year: number | null, base: Date) => {
  const date = new Date(year ?? base.getFullYear(), month - 1, day, 12)
  if (date.getMonth() !== month - 1) return null
  // Sin año, una fecha ya pasada es la del año que viene.
  if (year === null && iso(date) < iso(base)) date.setFullYear(date.getFullYear() + 1)
  return date
}

/** Pasa a 24 horas según el momento del día: "9 de la noche" son las 21:00. */
const withPeriod = (hour: number, period: string) => {
  if (period === 'tarde') return hour >= 1 && hour <= 11 ? hour + 12 : hour
  if (period === 'noche') {
    if (hour === 12) return 0
    return hour >= 7 && hour <= 11 ? hour + 12 : hour
  }
  return hour === 12 ? 0 : hour
}

export function parseQuickAdd(
  raw: string,
  now = new Date(),
  fallback?: { date: Date; start: number },
): ParsedEvent {
  let text = raw.trim()
  let matchedDay = false
  let matchedTime = false
  let dayOffset = 0
  let start = fallback?.start ?? 0
  let absolute: Date | null = null
  let sameWeekday = false
  const base = fallback?.date ?? startOfDay(now)

  const takeTime = (hours: number, minutes: number) => {
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      start = hours * 60 + minutes
      matchedTime = true
    }
  }

  // Primero la hora con su momento: si no, "de la mañana" se leería como otro día.
  let match = text.match(
    word('(?:a\\s+las?\\s+)?([01]?\\d|2[0-3])(?:[:.]([0-5]\\d))?(?:\\s+y\\s+(media|cuarto))?\\s+de\\s+la\\s+(mañana|manana|tarde|noche)'),
  )
  if (match) {
    const extra = match[3]?.toLowerCase() === 'media' ? 30 : match[3] ? 15 : 0
    takeTime(withPeriod(Number(match[1]), match[4].toLowerCase()), Number(match[2] ?? 0) + extra)
    text = text.replace(match[0], ' ')
  }
  let periodHour: number | null = null
  match = text.match(word('por\\s+la\\s+(mañana|manana|tarde|noche)'))
  if (match) {
    const period = match[1].toLowerCase()
    periodHour = period === 'tarde' ? 16 : period === 'noche' ? 21 : 9
    text = text.replace(match[0], ' ')
  }

  // Fechas concretas: "12 de noviembre", "12/11", "12/11/2026".
  match = text.match(word(`(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${MONTH_WORDS.join('|')})(?:\\s+(?:de\\s+)?(\\d{4}))?`))
  if (match) {
    const date = atDay(Number(match[1]), MONTH_WORDS.indexOf(match[2].toLowerCase()) + 1, match[3] ? Number(match[3]) : null, base)
    if (date) {
      absolute = date
      matchedDay = true
      text = text.replace(match[0], ' ')
    }
  }
  if (!absolute) {
    match = text.match(word('(?:el\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}))?'))
    if (match) {
      const date = atDay(Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : null, base)
      if (date) {
        absolute = date
        matchedDay = true
        text = text.replace(match[0], ' ')
      }
    }
  }

  if (!matchedDay) {
    // Relative days first (longest match wins).
    const relative: { re: RegExp; offset: number }[] = [
      { re: word('pasado\\s+mañana'), offset: 2 },
      { re: word('pasado\\s+manana'), offset: 2 },
      { re: word('mañana'), offset: 1 },
      { re: word('manana'), offset: 1 },
      { re: word('hoy'), offset: 0 },
    ]
    for (const { re, offset } of relative) {
      if (re.test(text)) {
        dayOffset = offset
        matchedDay = true
        text = text.replace(re, ' ')
        break
      }
    }
  }

  if (!matchedDay) {
    for (const [name, dow] of Object.entries(WEEKDAY_WORDS)) {
      const hit = text.match(word(`(?:(próximo|proximo|este|el)\\s+)?${name}`))
      if (!hit) continue
      dayOffset = (dow - base.getDay() + 7) % 7
      if (dayOffset === 0 && hit[1]?.toLowerCase().startsWith('pr')) dayOffset = 7
      sameWeekday = dayOffset === 0
      matchedDay = true
      text = text.replace(hit[0], ' ')
      break
    }
  }

  if (!matchedTime) {
    match = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)
    if (match) {
      takeTime(Number(match[1]), Number(match[2]))
      text = text.replace(match[0], ' ')
    }
  }

  if (!matchedTime) {
    match = text.match(/\ba\s+las?\s+([01]?\d|2[0-3])\b(?:\s+y\s+(media|cuarto))?/i)
    if (match) {
      const extra = match[2]?.toLowerCase() === 'media' ? 30 : match[2] ? 15 : 0
      // "A las 5" en una agenda son casi siempre las 17:00.
      const hour = Number(match[1])
      takeTime(hour >= 1 && hour <= 6 ? hour + 12 : hour, extra)
      text = text.replace(match[0], ' ')
    }
  }

  if (!matchedTime) {
    match = text.match(/\b([01]?\d|2[0-3])\s*h(?:oras?)?\b/i)
    if (match) {
      takeTime(Number(match[1]), 0)
      text = text.replace(match[0], ' ')
    }
  }

  if (!matchedTime && periodHour !== null) takeTime(periodHour, 0)

  if (!matchedTime && !fallback) {
    const next = Math.ceil((now.getHours() * 60 + now.getMinutes() + 30) / 30) * 30
    if (next >= 20 * 60 + 30) {
      start = 9 * 60
      if (!matchedDay) {
        dayOffset = 1
        matchedDay = true
      }
    } else {
      start = next
    }
  }

  // "Miércoles 09:00" escrito un miércoles a mediodía es el de la semana que viene.
  if (sameWeekday && matchedTime && iso(base) === iso(now) && start <= now.getHours() * 60 + now.getMinutes()) {
    dayOffset = 7
  }

  const title = text
    .replace(/\s+/g, ' ')
    .replace(/^[\s,·—-]+|[\s,·—-]+$/g, '')
    .replace(/^(el|la|los|las|para)\s+/i, '')
    .trim()
  const finalTitle = title ? title[0].toUpperCase() + title.slice(1) : 'Nuevo evento'
  const date = absolute ?? addDays(base, dayOffset)

  return {
    title: finalTitle,
    date: iso(date),
    start,
    duration: 60,
    category: guessCategory(raw),
    matchedDay,
    matchedTime,
  }
}
