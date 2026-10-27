/** Rango visible del calendario: de 7:00 a 23:00. */
export const DAY_START = 7 * 60
export const DAY_END = 23 * 60
export const TOTAL_MIN = DAY_END - DAY_START
export const SLOT = 30
export const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => 7 + i)

/** Jornada "útil" para huecos y carga del día. */
export const WORK_START = 8 * 60
export const WORK_END = 21 * 60
export const WORK_TOTAL = WORK_END - WORK_START

export const clampMinutes = (value: number) =>
  Math.min(DAY_END - SLOT, Math.max(DAY_START, Math.round(value / SLOT) * SLOT))

export const topPct = (start: number) =>
  ((Math.max(DAY_START, Math.min(DAY_END, start)) - DAY_START) / TOTAL_MIN) * 100

/** Altura recortada al rango visible para que nada se salga de la rejilla. */
export const heightPct = (duration: number, start = DAY_START) => {
  const from = Math.max(DAY_START, start)
  const to = Math.min(DAY_END, start + duration)
  return (Math.max(15, to - from) / TOTAL_MIN) * 100
}

export const overlaps = (
  a: { date: string; start: number; duration: number },
  b: { date: string; start: number; duration: number },
) =>
  a.date === b.date &&
  a.start < b.start + b.duration &&
  a.start + a.duration > b.start
