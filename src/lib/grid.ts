export const DAY_START = 8 * 60
export const DAY_END = 21 * 60
export const TOTAL_MIN = DAY_END - DAY_START
export const SLOT = 30
export const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i)

export const clampMinutes = (value: number) =>
  Math.min(DAY_END - SLOT, Math.max(DAY_START, Math.round(value / SLOT) * SLOT))

export const topPct = (start: number) => ((start - DAY_START) / TOTAL_MIN) * 100
export const heightPct = (duration: number) => (duration / TOTAL_MIN) * 100

export const overlaps = (
  a: { date: string; start: number; duration: number },
  b: { date: string; start: number; duration: number },
) =>
  a.date === b.date &&
  a.start < b.start + b.duration &&
  a.start + a.duration > b.start
