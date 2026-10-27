import { usePlanner } from '../state'
import { haptic } from '../lib/haptics'
import {
  MONTHS,
  WEEKDAYS_MINI,
  fmtTime,
  isToday,
  iso,
  monthMatrix,
  weekNumber,
} from '../lib/date'

type Props = {
  anchor: Date
  onOpen: (id: string) => void
  onPickDay: (day: Date) => void
}

export function MonthView({ anchor, onOpen, onPickDay }: Props) {
  const { eventsByDate } = usePlanner()
  const cells = monthMatrix(anchor)
  const rows = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
  const month = anchor.getMonth()

  return (
    <section className="month" aria-label={`Vista mensual de ${MONTHS[month]} ${anchor.getFullYear()}`}>
      <div className="month__head">
        <span className="month__week-head" aria-hidden="true">
          Sem
        </span>
        {WEEKDAYS_MINI.map((label, i) => {
          const full = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][i]
          return (
            <span key={label + i} className="month__dow" aria-label={full}>
              <span className="month__dow-short" aria-hidden="true">
                {label}
              </span>
              <span className="month__dow-full" aria-hidden="true">
                {full.slice(0, 3)}
              </span>
            </span>
          )
        })}
      </div>
      <div className="month__rows">
        {rows.map((week) => {
          const first = week[0]
          return (
            <div className="month__row" key={iso(first)}>
              <span className="month__week" aria-label={`Semana ${weekNumber(first)}`}>
                {weekNumber(first)}
              </span>
              {week.map((day) => {
                const date = iso(day)
                const dayEvents = eventsByDate.get(date) ?? []
                const outside = day.getMonth() !== month
                return (
                  <div
                    key={date}
                    className={`month__cell ${outside ? 'is-outside' : ''} ${
                      isToday(day) ? 'is-today' : ''
                    }`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return
                      onPickDay(day)
                    }}
                  >
                    <button
                      type="button"
                      className="month__day"
                      onClick={() => onPickDay(day)}
                      aria-label={`${day.getDate()} de ${MONTHS[day.getMonth()]}, ${
                        dayEvents.length
                      } eventos. Ver el día`}
                    >
                      {day.getDate()}
                    </button>
                    <div className="month__events">
                      {dayEvents.slice(0, 2).map((event) => (
                        <button
                          type="button"
                          key={event.id}
                          className={`month__chip month__chip--${event.category}`}
                          onClick={() => {
                            haptic('selection')
                            onOpen(event.id)
                          }}
                          title={`${fmtTime(event.start)} · ${event.title}`}
                          aria-label={`${event.title}, ${fmtTime(event.start)}`}
                        >
                          <i aria-hidden="true" />
                          <span className="month__chip-time">{fmtTime(event.start)}</span>
                          <span className="month__chip-title">{event.title}</span>
                        </button>
                      ))}
                      {dayEvents.length > 2 && (
                        <button
                          type="button"
                          className="month__more"
                          onClick={() => onPickDay(day)}
                        >
                          +{dayEvents.length - 2} más
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}
