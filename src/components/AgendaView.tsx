import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from 'motion/react'
import { ChevronUp, MapPin, Plus, Repeat2 } from 'lucide-react'
import type { CalEvent } from '../types'
import { CATEGORY_LABEL } from '../data'
import {
  MONTHS,
  WEEKDAYS,
  addDays,
  fmtDateMedium,
  fmtDuration,
  fmtMonth,
  fmtTime,
  isToday,
  iso,
  nowMinutes,
  startOfDay,
} from '../lib/date'
import { isRepeating } from '../lib/recurrence'
import { teamById, teamHex } from '../lib/teams'
import { haptic } from '../lib/haptics'
import { usePlanner } from '../state'
import { AvatarStack } from './ui'

type Props = {
  /** Cambiarla lleva la lista hasta ese día. */
  jumpTo: Date
  onOpen: (id: string) => void
  onSlotClick: (date: Date, start: number) => void
}

type Row =
  | { kind: 'month'; key: string; first: Date }
  | { kind: 'day'; key: string; day: Date; list: CalEvent[] }
  | { kind: 'free'; key: string; from: Date; to: Date }

/** Lista continua de días: los días sin nada se pliegan en una sola fila. */
function buildRows(from: Date, count: number, byDate: Map<string, CalEvent[]>): Row[] {
  const rows: Row[] = []
  const todayKey = iso(new Date())
  let month = ''
  let freeFrom: Date | null = null
  let previous = from
  const closeFree = (to: Date) => {
    if (freeFrom) rows.push({ kind: 'free', key: `f${iso(freeFrom)}`, from: freeFrom, to })
    freeFrom = null
  }
  const openMonth = (day: Date) => {
    const key = `${day.getFullYear()}-${day.getMonth()}`
    if (key !== month) {
      closeFree(previous)
      month = key
      rows.push({ kind: 'month', key: `m${key}`, first: day })
    }
  }
  for (let i = 0; i < count; i += 1) {
    const day = addDays(from, i)
    const key = iso(day)
    const list = byDate.get(key) ?? []
    openMonth(day)
    if (list.length === 0 && key !== todayKey) {
      if (!freeFrom) freeFrom = day
    } else {
      closeFree(previous)
      rows.push({ kind: 'day', key: `d${key}`, day, list })
    }
    previous = day
  }
  closeFree(previous)
  return rows
}

function EventRow({ event, past, current, onOpen }: { event: CalEvent; past: boolean; current: boolean; onOpen: (id: string) => void }) {
  const { teams, user, theme } = usePlanner()
  const team = teamById(teams, event.teamId)
  const checks = event.checklist?.length ?? 0
  const done = event.checklist?.filter((c) => c.done).length ?? 0
  const author = team && event.authorId && event.authorId !== user.id ? event.authorName : null

  return (
    <button
      type="button"
      className={`ag-event ag-event--${event.category} ${past ? 'is-past' : ''} ${current ? 'is-current' : ''}`}
      onClick={() => onOpen(event.id)}
    >
      <span className="ag-event__time">
        <strong>{fmtTime(event.start)}</strong>
        <span>{fmtDuration(event.duration)}</span>
      </span>
      <span className="ag-event__rail" aria-hidden="true" />
      <span className="ag-event__body">
        <span className="ag-event__head">
          <span className="ag-event__cat">{CATEGORY_LABEL[event.category]}</span>
          {isRepeating(event) && <Repeat2 size={12} strokeWidth={2} aria-label="Se repite" />}
          {current && (
            <span className="live">
              <i aria-hidden="true" />
              En curso
            </span>
          )}
          {team && (
            <span className="ag-team" style={{ ['--c' as string]: teamHex(team.color, theme === 'night') }}>
              <i aria-hidden="true" />
              {team.name}
            </span>
          )}
        </span>
        <span className="ag-event__title">{event.title}</span>
        {(event.location || checks > 0 || author || (event.attendees?.length ?? 0) > 0) && (
          <span className="ag-event__meta">
            {event.location && (
              <span className="ag-event__place">
                <MapPin size={12} strokeWidth={1.8} aria-hidden="true" />
                {event.location}
              </span>
            )}
            {checks > 0 && (
              <span>
                {done}/{checks} tareas
              </span>
            )}
            {author && <span>de {author}</span>}
            {event.attendees && event.attendees.length > 0 && <AvatarStack names={event.attendees} max={3} />}
          </span>
        )}
      </span>
    </button>
  )
}

export function AgendaView({ jumpTo, onOpen, onSlotClick }: Props) {
  const { eventsByDate, now } = usePlanner()
  const nowMin = nowMinutes(now)
  const [from, setFrom] = useState(() => startOfDay(new Date()))
  const [count, setCount] = useState(60)
  const end = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLElement>(null)
  const firstJump = useRef(true)
  const rows = useMemo(() => buildRows(from, count, eventsByDate), [from, count, eventsByDate])

  // Al acercarse al final se cargan más días, sin botones.
  useEffect(() => {
    const node = end.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setCount((value) => value + 60)
      },
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const showBefore = (days: number) => {
    setFrom((value) => addDays(value, -days))
    setCount((value) => value + days)
  }

  // Los botones de la barra llevan la lista hasta el día pedido.
  useEffect(() => {
    if (firstJump.current) {
      firstJump.current = false
      return
    }
    const target = startOfDay(jumpTo)
    if (target < from) {
      const days = Math.ceil((from.getTime() - target.getTime()) / 86_400_000) + 7
      showBefore(days)
    } else {
      const ahead = Math.ceil((target.getTime() - from.getTime()) / 86_400_000)
      if (ahead >= count) setCount(ahead + 60)
    }
    const raf = requestAnimationFrame(() => {
      const targetKey = iso(target)
      const nodes = list.current?.querySelectorAll<HTMLElement>('[data-agenda-day]') ?? []
      for (const node of nodes) {
        if ((node.dataset.agendaEnd ?? node.dataset.agendaDay ?? '') >= targetKey) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' })
          break
        }
      }
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo])

  return (
    <section className="agenda" aria-label="Agenda" ref={list}>
      <button
        type="button"
        className="ag-past"
        onClick={() => {
          haptic('selection')
          showBefore(14)
        }}
      >
        <ChevronUp size={15} strokeWidth={2} aria-hidden="true" />
        Ver días anteriores
      </button>
      {rows.map((row, index) => {
        if (row.kind === 'month') {
          return (
            <h3 key={row.key} className="ag-month">
              {fmtMonth(row.first).replace(/^./, (c) => c.toUpperCase())}
            </h3>
          )
        }
        if (row.kind === 'free') {
          return (
            <button
              key={row.key}
              type="button"
              className="ag-free"
              data-agenda-day={iso(row.from)}
              data-agenda-end={iso(row.to)}
              onClick={() => {
                haptic('selection')
                onSlotClick(row.from, 9 * 60)
              }}
            >
              <span>
                Libre · {fmtDateMedium(row.from)}
                {iso(row.from) !== iso(row.to) && ` – ${fmtDateMedium(row.to)}`}
              </span>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          )
        }
        const { day, list: dayList } = row
        const date = iso(day)
        const today = isToday(day)
        const busy = dayList.reduce((sum, e) => sum + e.duration, 0)
        const nextIdx = today ? dayList.findIndex((e) => e.start + e.duration > nowMin) : -1
        return (
          <m.div
            key={row.key}
            className={`ag-day ${today ? 'is-today' : ''} ${dayList.length === 0 ? 'is-empty' : ''}`}
            data-agenda-day={date}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: Math.min(index * 0.02, 0.2) }}
          >
            <header className="ag-day__head">
              <span className="ag-day__num">{day.getDate()}</span>
              <span className="ag-day__label">
                <strong>{WEEKDAYS[(day.getDay() + 6) % 7]}</strong>
                <span>
                  {dayList.length > 0 ? `${dayList.length} ${dayList.length === 1 ? 'evento' : 'eventos'} · ${fmtDuration(busy)}` : 'libre'}
                </span>
              </span>
              {today && <span className="ag-day__today">Hoy</span>}
              <button
                type="button"
                className="ag-day__add"
                aria-label={`Añadir evento el ${day.getDate()} de ${MONTHS[day.getMonth()]}`}
                onClick={() => {
                  haptic('selection')
                  onSlotClick(day, 9 * 60)
                }}
              >
                <Plus size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </header>

            {dayList.length === 0 ? null : (
              <div className="ag-day__list">
                {dayList.map((event, i) => {
                  const past = today && event.start + event.duration <= nowMin
                  const current = today && event.start <= nowMin && event.start + event.duration > nowMin
                  return (
                    <div key={event.id}>
                      {today && i === nextIdx && !current && (
                        <div className="ag-now" aria-hidden="true">
                          <span>Ahora · {fmtTime(nowMin)}</span>
                        </div>
                      )}
                      <EventRow event={event} past={past} current={current} onOpen={onOpen} />
                    </div>
                  )
                })}
              </div>
            )}
          </m.div>
        )
      })}
      <div ref={end} aria-hidden="true" />
    </section>
  )
}
