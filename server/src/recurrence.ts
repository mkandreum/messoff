/** Lo mínimo que hace falta de un evento para saber en qué días cae. */
export type RepeatRule = {
  date: string
  repeat: string
  repeatUntil: string | null
  repeatSkip: string[]
}

const toDate = (value: string) => new Date(`${value}T00:00:00Z`)
const toIso = (date: Date) => date.toISOString().slice(0, 10)

/** ¿Cae el evento en este día? */
export function occursOn(rule: RepeatRule, day: string): boolean {
  if (rule.repeat === 'none') return rule.date === day
  if (day < rule.date || rule.repeatSkip.includes(day)) return false
  if (rule.repeatUntil && day > rule.repeatUntil) return false
  const first = toDate(rule.date)
  const target = toDate(day)
  switch (rule.repeat) {
    case 'daily':
      return true
    case 'weekdays':
      return target.getUTCDay() !== 0 && target.getUTCDay() !== 6
    case 'weekly':
      return (target.getTime() - first.getTime()) % (7 * 86_400_000) === 0
    case 'monthly':
      return target.getUTCDate() === first.getUTCDate()
    default:
      return rule.date === day
  }
}

export const nextDay = (day: string) => {
  const date = toDate(day)
  date.setUTCDate(date.getUTCDate() + 1)
  return toIso(date)
}
