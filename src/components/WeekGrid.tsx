import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useMotionValue } from 'motion/react'
import { createPortal } from 'react-dom'
import type { CalEvent } from '../types'
import {
  MONTHS,
  WEEKDAYS_SHORT,
  fmtDateMedium,
  fmtTime,
  isToday,
  iso,
  nowMinutes,
  parseISO,
} from '../lib/date'
import {
  DAY_END,
  DAY_START,
  HOURS,
  SLOT,
  TOTAL_MIN,
  clampMinutes,
  heightPct,
  overlaps,
  topPct,
} from '../lib/grid'
import { haptic, hapticTick } from '../lib/haptics'
import { usePlanner } from '../state'
import { EventCard } from './EventCard'

type Props = {
  days: Date[]
  onOpen: (id: string) => void
  onPickDay: (day: Date) => void
  onSlotClick?: (date: Date, start: number) => void
}

type DropTarget = { date: string; start: number }

/** Zoom CSS del documento: las coordenadas del puntero no lo incluyen. */
const pageZoom = () => parseFloat(getComputedStyle(document.documentElement).zoom) || 1

const offsetLabel = () => {
  const minutes = -new Date().getTimezoneOffset()
  const sign = minutes >= 0 ? '+' : '−'
  const abs = Math.abs(minutes)
  return `GMT${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''}`
}
type DragSession = {
  event: CalEvent
  rect: DOMRect
  startX: number
  startY: number
}

export function WeekGrid({ days, onOpen, onPickDay, onSlotClick }: Props) {
  const { moveEvent, notify, saveEvent, now, eventsByDate } = usePlanner()
  const scroller = useRef<HTMLDivElement>(null)
  const cols = useRef<HTMLDivElement>(null)
  const [dragEvent, setDragEvent] = useState<CalEvent | null>(null)
  const [ghostRect, setGhostRect] = useState<DOMRect | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const targetRef = useRef<DropTarget | null>(null)
  const session = useRef<DragSession | null>(null)
  const suppressUntil = useRef(0)
  const cleanup = useRef<(() => void) | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const setDropTarget = (next: DropTarget | null) => {
    const prev = targetRef.current
    if (prev?.date === next?.date && prev?.start === next?.start) return
    if (next && session.current) hapticTick()
    targetRef.current = next
    setTarget(next)
  }

  const finish = (commit: boolean) => {
    cleanup.current?.()
    cleanup.current = null
    suppressUntil.current = Date.now() + 450
    const active = session.current
    const drop = targetRef.current
    session.current = null
    setDragEvent(null)
    setGhostRect(null)
    setDropTarget(null)
    if (!active) return
    if (commit && drop) {
      if (drop.date === active.event.date && drop.start === active.event.start) {
        haptic('light')
        return
      }
      const previous = moveEvent(active.event.id, drop.date, drop.start)
      haptic('snap')
      notify(
        `«${active.event.title}» movido a ${fmtDateMedium(parseISO(drop.date))} · ${fmtTime(
          drop.start,
        )}`,
        'Deshacer',
        () => {
          if (previous) saveEvent(previous)
        },
      )
    } else if (commit) {
      haptic('warning')
    }
  }

  const beginDrag = (event: CalEvent, rect: DOMRect, fromX: number, fromY: number) => {
    session.current = { event, rect, startX: fromX, startY: fromY }
    setDragEvent(event)
    setGhostRect(rect)
    x.set(0)
    y.set(0)
    suppressUntil.current = Date.now() + 700
    haptic('medium')

    const onMove = (e: PointerEvent) => {
      e.preventDefault()
      const current = session.current
      if (!current) return
      const z = pageZoom()
      x.set((e.clientX - current.startX) / z)
      y.set((e.clientY - current.startY) / z)

      const el = document.elementFromPoint(e.clientX, e.clientY)
      const col = el?.closest<HTMLElement>('[data-date]')
      if (!col) {
        setDropTarget(null)
      } else {
        const box = col.getBoundingClientRect()
        const ratio = Math.min(0.999, Math.max(0, (e.clientY - box.top) / box.height))
        const start = clampMinutes(DAY_START + ratio * TOTAL_MIN)
        setDropTarget({ date: col.dataset.date ?? '', start })
      }

      const scroll = scroller.current
      if (scroll) {
        const box = scroll.getBoundingClientRect()
        if (e.clientY > box.bottom - 64) scroll.scrollTop += 10
        else if (e.clientY < box.top + 64) scroll.scrollTop -= 10
        if (e.clientX > box.right - 52) scroll.scrollLeft += 12
        else if (e.clientX < box.left + 52) scroll.scrollLeft -= 12
      }
    }

    const onUp = () => finish(true)
    const onCancel = () => finish(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false)
    }
    const blockTouch = (e: TouchEvent) => {
      if (session.current) e.preventDefault()
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    document.addEventListener('touchmove', blockTouch, { passive: false })
    cleanup.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('touchmove', blockTouch)
    }
  }

  const onPressStart = (e: React.PointerEvent<HTMLElement>, event: CalEvent) => {
    if (dragEvent || (e.pointerType === 'mouse' && e.button !== 0) || !e.isPrimary) return
    const node = e.currentTarget
    const rect = node.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const isTouch = e.pointerType === 'touch'
    const fromHandle = !!(e.target as HTMLElement).closest('[data-drag-handle]')
    let armed = false
    let holdTimer: number | undefined

    const stopPress = () => {
      if (holdTimer) window.clearTimeout(holdTimer)
      holdTimer = undefined
      window.removeEventListener('pointermove', watch)
      window.removeEventListener('pointerup', stopPress)
      window.removeEventListener('pointercancel', abort)
    }

    const arm = () => {
      if (armed) return
      armed = true
      stopPress()
      beginDrag(event, rect, startX, startY)
    }

    const watch = (ev: PointerEvent) => {
      if (armed) return
      const distance = Math.hypot(ev.clientX - startX, ev.clientY - startY)
      if (!isTouch || fromHandle) {
        // Ratón, lápiz o asa táctil: el gesto empieza al mover, sin espera.
        if (distance > 4) arm()
      } else if (distance > 10) {
        // En táctil, si se mueve antes de tiempo, es scroll.
        stopPress()
      }
    }

    const abort = () => stopPress()

    if (isTouch && !fromHandle) {
      holdTimer = window.setTimeout(arm, 300)
    }

    window.addEventListener('pointermove', watch)
    window.addEventListener('pointerup', stopPress)
    window.addEventListener('pointercancel', abort)
  }

  const suppressClick = () => Date.now() < suppressUntil.current

  useEffect(() => () => cleanup.current?.(), [])

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const scroll = scroller.current
      const grid = cols.current
      if (!scroll || !grid) return
      const colHeight = grid.getBoundingClientRect().height
      const showsToday = days.some((d) => isToday(d))
      const focus = showsToday
        ? Math.max(DAY_START, Math.min(DAY_END - 4 * 60, nowMinutes() - 90))
        : 8 * 60
      scroll.scrollTop = Math.max(0, ((focus - DAY_START) / TOTAL_MIN) * colHeight - 16)
      const todayIndex = days.findIndex((d) => isToday(d))
      if (todayIndex > 0 && days.length > 3) {
        const colWidth = grid.getBoundingClientRect().width / days.length
        const boxWidth = scroll.clientWidth
        if (colWidth * days.length > boxWidth) {
          scroll.scrollLeft = Math.max(0, colWidth * todayIndex - 24)
        }
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [days])

  const nowMin = nowMinutes(now)
  const activeConflicts =
    dragEvent && target
      ? (eventsByDate.get(target.date) ?? []).filter(
          (e) =>
            e.id !== dragEvent.id &&
            overlaps(
              { date: target.date, start: target.start, duration: dragEvent.duration },
              e,
            ),
        )
      : []

  return (
    <section
      className={`cal ${days.length === 1 ? 'cal--single' : ''}`}
      aria-label={days.length === 1 ? 'Vista del día' : 'Calendario semanal'}
    >
      <div className="cal__scroll" ref={scroller}>
        <div className="cal__inner">
          <div className="cal__head">
            <div className="cal__corner" aria-hidden="true">
              <span>{offsetLabel()}</span>
            </div>
            <div className="cal__heads">
              {days.map((day) => {
                const dayEvents = eventsByDate.get(iso(day)) ?? []
                return (
                  <button
                    type="button"
                    key={iso(day)}
                    className={`cal__day-head ${isToday(day) ? 'is-today' : ''}`}
                    onClick={() => onPickDay(day)}
                  >
                    <span className="cal__dow">{WEEKDAYS_SHORT[(day.getDay() + 6) % 7]}</span>
                    <span className="cal__num">{day.getDate()}</span>
                    {day.getDate() === 1 && (
                      <span className="cal__month">{MONTHS[day.getMonth()].slice(0, 3)}</span>
                    )}
                    <span className="sr-only">
                      , {dayEvents.length} eventos. Ver el día
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="cal__grid">
            <div className="cal__gutter" aria-hidden="true">
              {HOURS.map((hour) => (
                <span key={hour} className="cal__hour" style={{ top: `${topPct(hour * 60)}%` }}>
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            <div className="cal__cols" ref={cols}>
              {days.map((day) => {
                const date = iso(day)
                const dayEvents = eventsByDate.get(date) ?? []
                const isDrop = target?.date === date
                const stacked = new Set<string>()
                let maxEnd = -1
                for (const event of dayEvents) {
                  if (event.start < maxEnd) stacked.add(event.id)
                  maxEnd = Math.max(maxEnd, event.start + event.duration)
                }
                return (
                  <div
                    key={date}
                    className={`cal__col ${isToday(day) ? 'is-today' : ''} ${
                      isDrop ? 'is-drop' : ''
                    }`}
                    data-date={date}
                    onClick={(e) => {
                      if (e.target !== e.currentTarget || !onSlotClick || suppressClick()) return
                      const box = e.currentTarget.getBoundingClientRect()
                      const ratio = (e.clientY - box.top) / box.height
                      onSlotClick(day, clampMinutes(DAY_START + ratio * TOTAL_MIN))
                    }}
                  >
                    {isToday(day) && nowMin >= DAY_START && nowMin <= DAY_END && (
                      <div
                        className="cal__now"
                        style={{ top: `${topPct(nowMin)}%` }}
                        aria-hidden="true"
                      >
                        <span className="cal__now-dot" />
                        <span className="cal__now-line" />
                      </div>
                    )}

                    {dayEvents.map((event, index) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        index={index}
                        onOpen={onOpen}
                        onPressStart={onPressStart}
                        suppressClick={suppressClick}
                        origin={dragEvent?.id === event.id}
                        stacked={stacked.has(event.id)}
                      />
                    ))}

                    {isDrop && dragEvent && target && (
                      <div
                        className={`drop-slot ${activeConflicts.length ? 'has-conflict' : ''}`}
                        style={{
                          top: `${topPct(target.start)}%`,
                          height: `calc(${heightPct(dragEvent.duration, target.start)}% - 5px)`,
                        }}
                        aria-hidden="true"
                      >
                        <span className="drop-slot__time">{fmtTime(target.start)}</span>
                        {activeConflicts.length > 0 && (
                          <span className="drop-slot__warn">Se solapa</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="cal__hint">
        <span className="cal__hint-dot" aria-hidden="true" />
        Arrastra un evento a otro día (en móvil, mantén pulsado). Toca un hueco para crear.
      </p>

      {createPortal(
        <AnimatePresence>
          {dragEvent && ghostRect && (
            <m.div
              className={`drag-ghost drag-ghost--${dragEvent.category}`}
              aria-hidden="true"
              style={{
                left: ghostRect.left / pageZoom(),
                top: ghostRect.top / pageZoom(),
                width: ghostRect.width / pageZoom(),
                height: ghostRect.height / pageZoom(),
                x,
                y,
              }}
              initial={{ opacity: 0, scale: 0.98, rotate: 0 }}
              animate={{ opacity: 1, scale: 1.035, rotate: -1.6 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            >
              <span className="drag-ghost__flag">
                {target ? `${fmtTime(target.start)} · mover` : 'Arrastra'}
              </span>
              <span className="drag-ghost__time">{fmtTime(dragEvent.start)}</span>
              <span className="drag-ghost__title">{dragEvent.title}</span>
              {target && (
                <span className="drag-ghost__target">
                  {fmtDateMedium(parseISO(target.date))}
                  {activeConflicts.length > 0 && ' · se solapa'}
                </span>
              )}
            </m.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </section>
  )
}
