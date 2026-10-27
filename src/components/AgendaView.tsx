import { useEffect, useState } from 'react'
import { m } from 'motion/react'
import { ChevronDown, MapPin, Plus } from 'lucide-react'
import type { CalEvent } from '../types'
import { CATEGORY_LABEL } from '../data'
import {
  MONTHS,
  WEEKDAYS,
  fmtDuration,
  fmtTime,
  isToday,
  iso,
  nowMinutes,
} from '../lib/date'
import { teamById, teamHex } from '../lib/teams'
import { haptic } from '../lib/haptics'
import { usePlanner } from '../state'
import { AvatarStack } from './ui'

type Props = {
  days: Date[]
  onOpen: (id: string) => void
  onSlotClick: (date: Date, start: number) => void
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

export function AgendaView({ days, onOpen, onSlotClick }: Props) {
  const { eventsByDate, now } = usePlanner()
  const nowMin = nowMinutes(now)
  const [showPast, setShowPast] = useState(false)
  const firstKey = iso(days[0])
  useEffect(() => setShowPast(false), [firstKey])

  // En la semana actual, los días ya pasados quedan plegados.
  const todayIndex = days.findIndex((day) => isToday(day))
  const hiddenPast = !showPast && todayIndex > 0 ? todayIndex : 0
  const visibleDays = hiddenPast ? days.slice(hiddenPast) : days
  const total = days.reduce((sum, day) => sum + (eventsByDate.get(iso(day))?.length ?? 0), 0)

  return (
    <section className="agenda" aria-label="Agenda">
      {total === 0 && (
        <div className="empty">
          <span className="empty__mark" aria-hidden="true">
            ✳
          </span>
          <p className="empty__title">Semana en blanco.</p>
          <p className="empty__copy">Toca un día para añadir lo primero que importe.</p>
        </div>
      )}
      {hiddenPast > 0 && (
        <button
          type="button"
          className="ag-past"
          onClick={() => {
            haptic('selection')
            setShowPast(true)
          }}
        >
          <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
          Ver {hiddenPast === 1 ? 'el día anterior' : `los ${hiddenPast} días anteriores`}
        </button>
      )}
      {visibleDays.map((day, index) => {
        const date = iso(day)
        const list = eventsByDate.get(date) ?? []
        const today = isToday(day)
        const busy = list.reduce((sum, e) => sum + e.duration, 0)
        const nextIdx = today ? list.findIndex((e) => e.start + e.duration > nowMin) : -1
        return (
          <m.div
            key={date}
            className={`ag-day ${today ? 'is-today' : ''} ${list.length === 0 ? 'is-empty' : ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: Math.min(index * 0.035, 0.2) }}
          >
            <header className="ag-day__head">
              <span className="ag-day__num">{day.getDate()}</span>
              <span className="ag-day__label">
                <strong>{WEEKDAYS[(day.getDay() + 6) % 7]}</strong>
                <span>
                  {index === 0 || day.getDate() === 1 ? `${MONTHS[day.getMonth()]} · ` : ''}
                  {list.length > 0 ? `${list.length} ${list.length === 1 ? 'evento' : 'eventos'} · ${fmtDuration(busy)}` : 'libre'}
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

            {list.length === 0 ? null : (
              <div className="ag-day__list">
                {list.map((event, i) => {
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
    </section>
  )
}
