import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { expandEvents, layoutDay, occurrenceDate, seriesId } from './recurrence'
import { parseQuickAdd } from './parse'
import type { CalEvent } from '../types'

// Los casos viven en un JSON idéntico al de la APK: los dos analizadores deben coincidir.
const cases = JSON.parse(readFileSync(new URL('./parse-cases.json', import.meta.url), 'utf8')) as {
  text: string
  title: string
  date: string
  start: number
}[]
const now = new Date(2026, 10, 4, 12, 33)

for (const item of cases) {
  test(`analiza «${item.text}»`, () => {
    const parsed = parseQuickAdd(item.text, now)
    assert.equal(parsed.title, item.title)
    assert.equal(parsed.date, item.date)
    assert.equal(parsed.start, item.start)
  })
}

const event = (partial: Partial<CalEvent>): CalEvent => ({
  id: 'a',
  title: 'x',
  date: '2026-11-05',
  start: 600,
  duration: 60,
  category: 'trabajo',
  ...partial,
})

const days = (e: CalEvent, from: string, to: string) => expandEvents([e], from, to).map((item) => item.date)

test('repetición semanal y desde mitad de ventana', () => {
  const weekly = event({ repeat: 'weekly' })
  assert.deepEqual(days(weekly, '2026-11-01', '2026-11-20'), ['2026-11-05', '2026-11-12', '2026-11-19'])
  assert.deepEqual(days(weekly, '2026-12-01', '2026-12-05'), ['2026-12-03'])
})

test('laborables, meses sin día 31, fin y excepciones', () => {
  assert.deepEqual(days(event({ date: '2026-11-06', repeat: 'weekdays' }), '2026-11-06', '2026-11-09'), ['2026-11-06', '2026-11-09'])
  assert.deepEqual(days(event({ date: '2026-10-31', repeat: 'monthly' }), '2026-10-01', '2027-02-28'), ['2026-10-31', '2026-12-31', '2027-01-31'])
  assert.deepEqual(
    days(event({ date: '2026-11-02', repeat: 'daily', repeatUntil: '2026-11-04', repeatSkip: ['2026-11-03'] }), '2026-11-01', '2026-11-30'),
    ['2026-11-02', '2026-11-04'],
  )
})

test('ids de las apariciones', () => {
  const out = expandEvents([event({ repeat: 'weekly' })], '2026-11-05', '2026-11-12')
  assert.deepEqual(out.map((item) => item.id), ['a', 'a__2026-11-12'])
  assert.equal(seriesId('a__2026-11-12'), 'a')
  assert.equal(occurrenceDate('a__2026-11-12'), '2026-11-12')
  assert.equal(occurrenceDate('a'), null)
})

test('solapes en columnas', () => {
  const placed = layoutDay([
    event({ id: 'a', start: 600 }),
    event({ id: 'b', start: 630 }),
    event({ id: 'c', start: 670, duration: 30 }),
    event({ id: 'd', start: 800, duration: 30 }),
  ])
  assert.deepEqual(placed.get('a'), { column: 0, columns: 2 })
  assert.deepEqual(placed.get('b'), { column: 1, columns: 2 })
  assert.deepEqual(placed.get('c'), { column: 0, columns: 2 })
  assert.deepEqual(placed.get('d'), { column: 0, columns: 1 })
})
