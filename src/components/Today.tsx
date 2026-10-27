import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  MapPin,
  Sparkles,
} from 'lucide-react'
import type { CalEvent } from '../types'
import { CATEGORY_LABEL } from '../data'
import {
  WEEKDAYS_MINI,
  allWeekDays,
  fmtDuration,
  fmtTime,
  iso,
  isToday,
  nowMinutes,
  relativeCountdown,
} from '../lib/date'
import { WORK_END as DAY_END, WORK_START as DAY_START, WORK_TOTAL as TOTAL_MIN } from '../lib/grid'
import { haptic } from '../lib/haptics'
import { usePlanner } from '../state'
import { AvatarStack } from './ui'
import { TaskRow } from './TaskRow'

type Props = {
  onOpen: (id: string) => void
  onGoWeek: () => void
  onGoTasks: () => void
  onGoFocus: () => void
}

const gapList = (events: CalEvent[]) => {
  const sorted = events
    .filter((e) => e.start < DAY_END && e.start + e.duration > DAY_START)
    .sort((a, b) => a.start - b.start)
  const out: { start: number; end: number }[] = []
  let cursor = DAY_START
  for (const event of sorted) {
    if (event.start - cursor >= 30) {
      out.push({ start: cursor, end: Math.min(event.start, DAY_END) })
    }
    cursor = Math.max(cursor, event.start + event.duration)
  }
  if (DAY_END - cursor >= 30) out.push({ start: cursor, end: DAY_END })
  return out
}

export function TodayView({ onOpen, onGoWeek, onGoTasks, onGoFocus }: Props) {
  const { eventsByDate, tasks, now, toggleTask, scheduleTask, notify, unscheduleTask } = usePlanner()
  const today = iso(now)
  const nowMin = nowMinutes(now)
  const todayEvents = eventsByDate.get(today) ?? []
  const current = todayEvents.find((e) => e.start <= nowMin && e.start + e.duration > nowMin)
  const next = todayEvents.find((e) => e.start > nowMin)
  const busy = todayEvents.reduce((sum, e) => sum + e.duration, 0)
  const gaps = gapList(todayEvents)
  const freeMinutes = gaps.reduce((sum, g) => sum + (g.end - g.start), 0)
  const pending = tasks.filter((t) => !t.done)
  const dueAll = pending.filter((t) => t.due === today || (t.due && t.due < today))
  const dueToday = dueAll.slice(0, 4)
  const nextIndex = todayEvents.findIndex((e) => e.start + e.duration > nowMin)
  const week = allWeekDays(now)
  const weekBusy = week.map((day) =>
    (eventsByDate.get(iso(day)) ?? []).reduce((sum, e) => sum + e.duration, 0),
  )
  const weekTotal = weekBusy.reduce((sum, v) => sum + v, 0)
  const longestGap = [...gaps].sort((a, b) => b.end - b.start - (a.end - a.start))[0]

  const schedule = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const created = await scheduleTask(taskId)
    if (!created) return
    haptic('success')
    notify(
      `«${task.title}» va al calendario a las ${fmtTime(created.start)}`,
      'Deshacer',
      () => unscheduleTask(created.id, task.id),
    )
  }

  return (
    <div className="today">
      <div className="stats">
        <div className="stat">
          <span className="stat__label">Eventos</span>
          <span className="stat__value">{todayEvents.length}</span>
          <span className="stat__hint">hoy</span>
        </div>
        <div className="stat">
          <span className="stat__label">Tiempo ocupado</span>
          <span className="stat__value">{fmtDuration(busy)}</span>
          <span className="stat__hint">de {fmtDuration(TOTAL_MIN)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Huecos libres</span>
          <span className="stat__value">{gaps.length}</span>
          <span className="stat__hint">{fmtDuration(freeMinutes)} sin plan</span>
        </div>
        <div className="stat stat--accent">
          <span className="stat__label">Pendientes</span>
          <span className="stat__value">{pending.length}</span>
          <span className="stat__hint">{dueAll.length} para hoy</span>
        </div>
      </div>

      <div className="today__grid">
        <div className="today__main">
          <section className="panel" aria-label="Agenda de hoy">
            <header className="panel__head">
              <div>
                <h2 className="panel__title">Agenda de hoy</h2>
                <p className="panel__sub">{fmtDuration(busy)} planificados · margen de sobra</p>
              </div>
              <button type="button" className="link" onClick={onGoWeek}>
                Ver semana <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>

            {todayEvents.length === 0 ? (
              <div className="empty">
                <span className="empty__mark" aria-hidden="true">✳</span>
                <p className="empty__title">Hoy no hay nada escrito.</p>
                <p className="empty__copy">Un día entero por delante. Elige una cosa que importe.</p>
              </div>
            ) : (
              <ol className="timeline">
                {todayEvents.map((event, index) => {
                  const isCurrent = current?.id === event.id
                  const isPast = event.start + event.duration <= nowMin
                  const checked = event.checklist?.filter((c) => c.done).length ?? 0
                  const totalChecks = event.checklist?.length ?? 0
                  return (
                    <li key={event.id}>
                      {index === nextIndex && !isCurrent && (
                        <div className="timeline__now" aria-hidden="true">
                          <span>Ahora · {fmtTime(nowMin)}</span>
                        </div>
                      )}
                      <div
                        className={`tl ${isPast ? 'is-past' : ''} ${
                          isCurrent ? 'is-current' : ''
                        }`}
                      >
                        <div className="tl__time">
                          <span className="tl__start">{fmtTime(event.start)}</span>
                          <span className="tl__end">{fmtTime(event.start + event.duration)}</span>
                        </div>
                        <div className="tl__track" aria-hidden="true">
                          <span className={`tl__dot dot--${event.category}`} />
                        </div>
                        <button
                          type="button"
                          className={`tl__card tl__card--${event.category}`}
                          onClick={() => onOpen(event.id)}
                        >
                          <span className="tl__head">
                            <span className="tl__cat">{CATEGORY_LABEL[event.category]}</span>
                            {isCurrent && (
                              <span className="live">
                                <i aria-hidden="true" />
                                En curso
                              </span>
                            )}
                            {isPast && <span className="tl__done">Hecho</span>}
                          </span>
                          <span className="tl__title">{event.title}</span>
                          <span className="tl__foot">
                            {event.location && (
                              <span className="tl__place">
                                <MapPin size={12} strokeWidth={1.8} aria-hidden="true" />
                                {event.location}
                              </span>
                            )}
                            {event.attendees && event.attendees.length > 0 && (
                              <AvatarStack names={event.attendees} max={3} />
                            )}
                            {totalChecks > 0 && (
                              <span className="tl__checks">
                                {checked}/{totalChecks} tareas
                              </span>
                            )}
                            <ArrowUpRight
                              className="tl__arrow"
                              size={15}
                              strokeWidth={1.7}
                              aria-hidden="true"
                            />
                          </span>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            <footer className="free-slots">
              <span className="free-slots__label">
                <Clock3 size={13} strokeWidth={1.8} aria-hidden="true" />
                Huecos para ti
              </span>
              <div className="free-slots__list">
                {gaps.length === 0 && <span className="free-slots__none">Día completo</span>}
                {gaps.map((gap) => (
                  <span className="slot" key={gap.start}>
                    {fmtTime(gap.start)} – {fmtTime(gap.end)}
                    <em>{fmtDuration(gap.end - gap.start)}</em>
                  </span>
                ))}
              </div>
            </footer>
          </section>
        </div>

        <aside className="today__side">
          <section className={`nowcard ${current ? 'is-live' : ''}`} aria-label="Ahora">
            <div className="nowcard__top">
              <span className="eyebrow eyebrow--light">
                {current ? 'AHORA MISMO' : 'LO SIGUIENTE'}
              </span>
              {current && (
                <span className="live live--light">
                  <i aria-hidden="true" />
                  en curso
                </span>
              )}
            </div>
            {current ? (
              <>
                <h2 className="nowcard__title">{current.title}</h2>
                <p className="nowcard__meta">
                  {fmtTime(current.start)} – {fmtTime(current.start + current.duration)} ·{' '}
                  {current.location || 'Sin ubicación'}
                </p>
                <div className="nowcard__bar" aria-hidden="true">
                  <i
                    style={{
                      width: `${Math.min(
                        100,
                        ((nowMin - current.start) / current.duration) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="nowcard__foot">
                  <span>{fmtDuration(current.start + current.duration - nowMin)} restantes</span>
                  <button type="button" className="nowcard__cta" onClick={onGoFocus}>
                    Enfocar <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : next ? (
              <>
                <h2 className="nowcard__title">{next.title}</h2>
                <p className="nowcard__meta">
                  Empieza {relativeCountdown(next.date, next.start, now)} ·{' '}
                  {fmtTime(next.start)}
                </p>
                <div className="nowcard__foot">
                  <span>{next.location || 'Sin ubicación'}</span>
                  <button type="button" className="nowcard__cta" onClick={onGoFocus}>
                    Enfocar <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="nowcard__title">Día terminado.</h2>
                <p className="nowcard__meta">
                  Cierra el portátil. Mañana empieza con luz a las 8:00.
                </p>
                <div className="nowcard__foot">
                  <span>Sin eventos pendientes</span>
                  <button type="button" className="nowcard__cta" onClick={onGoWeek}>
                    Ver mañana <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="panel panel--tight" aria-label="Pendientes de hoy">
            <header className="panel__head">
              <h2 className="panel__title">Pendientes</h2>
              <button type="button" className="link" onClick={onGoTasks}>
                Bandeja <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>
            <div className="tasks tasks--compact">
              {dueToday.length === 0 && (
                <p className="tasks__empty">Nada urgente. Buen síntoma.</p>
              )}
              {dueToday.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onSchedule={(t) => schedule(t.id)}
                  showTag={false}
                />
              ))}
            </div>
          </section>

          <section className="panel panel--tight" aria-label="Carga de la semana">
            <header className="panel__head">
              <h2 className="panel__title">Ritmo semanal</h2>
              <span className="panel__aside">{fmtDuration(weekTotal)}</span>
            </header>
            <div className="load">
              {week.map((day, i) => {
                const pct = Math.min(100, (weekBusy[i] / 480) * 100)
                return (
                  <div className="load__col" key={iso(day)}>
                    <div className="load__bar">
                      <i
                        className={isToday(day) ? 'is-today' : ''}
                        style={{ height: `${Math.max(pct, 4)}%` }}
                        title={`${WEEKDAYS_MINI[i]} · ${fmtDuration(weekBusy[i])}`}
                      />
                    </div>
                    <span className={isToday(day) ? 'is-today' : ''}>{WEEKDAYS_MINI[i]}</span>
                  </div>
                )
              })}
            </div>
            {longestGap && (
              <p className="load__note">
                <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" />
                Tu mejor hueco: {fmtTime(longestGap.start)} – {fmtTime(longestGap.end)}
              </p>
            )}
          </section>

          <p className="quote">
            «Deja aire entre las cosas.
            <br />
            También es parte del plan.»
          </p>
        </aside>
      </div>
    </div>
  )
}
