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
  const base = fallback?.date ?? startOfDay(now)

  // Relative days first (longest match wins).
  const relative: { re: RegExp; offset: number }[] = [
    { re: /\bpasado\s+mañana\b/i, offset: 2 },
    { re: /\bpasado\s+manana\b/i, offset: 2 },
    { re: /\bmañana\b/i, offset: 1 },
    { re: /\bmanana\b/i, offset: 1 },
    { re: /\bhoy\b/i, offset: 0 },
  ]
  for (const { re, offset } of relative) {
    if (re.test(text)) {
      dayOffset = offset
      matchedDay = true
      text = text.replace(re, ' ')
      break
    }
  }

  if (!matchedDay) {
    for (const [word, dow] of Object.entries(WEEKDAY_WORDS)) {
      const re = new RegExp(`\\b${word}\\b`, 'i')
      if (re.test(text)) {
        const currentDow = base.getDay()
        let diff = (dow - currentDow + 7) % 7
        if (diff === 0) diff = 0
        dayOffset = diff
        matchedDay = true
        text = text.replace(re, ' ')
        break
      }
    }
  }

  const takeTime = (hours: number, minutes: number) => {
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      start = hours * 60 + minutes
      matchedTime = true
    }
  }

  let match = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)
  if (match) {
    takeTime(Number(match[1]), Number(match[2]))
    text = text.replace(match[0], ' ')
  }

  if (!matchedTime) {
    match = text.match(/\ba\s+las\s+([01]?\d|2[0-3])\b(?:\s+y\s+(media|cuarto))?/i)
    if (match) {
      const extra = match[2]?.toLowerCase() === 'media' ? 30 : match[2] ? 15 : 0
      takeTime(Number(match[1]), extra)
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

  if (!matchedTime) {
    match = text.match(/\b([1-9]|1[0-2])\s*(?:de la\s+)?(tarde|noche)\b/i)
    if (match) {
      takeTime(Number(match[1]) + 12, 0)
      text = text.replace(match[0], ' ')
    }
  }

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

  const title = text
    .replace(/\s+/g, ' ')
    .replace(/^[\s,·—-]+|[\s,·—-]+$/g, '')
    .replace(/^(el|la|los|las|para)\s+/i, '')
    .trim()
  const finalTitle = title ? title[0].toUpperCase() + title.slice(1) : 'Nuevo evento'
  const date = addDays(base, dayOffset)

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
