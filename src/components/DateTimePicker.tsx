import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS, WEEKDAYS_MINI, WEEKDAYS_SHORT, addDays, iso, monthMatrix, parseISO, startOfWeek } from '../lib/date'
import { haptic, hapticTick } from '../lib/haptics'

const ROW = 54
const FRICTION = 0.94
const MIN_SPEED = 0.03

type WheelProps = {
  values: number[]
  value: number
  label: string
  onChange: (value: number) => void
  onTapCenter: () => void
}

/** Una rueda: se arrastra o se gira con la rueda del ratón y encaja en cada valor. */
function Wheel({ values, value, label, onChange, onTapCenter }: WheelProps) {
  const size = values.length
  const node = useRef<HTMLDivElement>(null)
  const spans = useRef<HTMLSpanElement[]>([])
  const motion = useRef({ pos: Math.max(0, values.indexOf(value)), speed: 0, target: null as number | null, raf: 0 })
  const drag = useRef<{ y: number; time: number; moved: boolean } | null>(null)
  const lastIndex = useRef(Math.round(motion.current.pos))
  const latest = useRef({ values, onChange })
  latest.current = { values, onChange }

  const valueAt = (index: number) => latest.current.values[((index % size) + size) % size]

  const paint = useCallback(() => {
    const { pos } = motion.current
    const center = Math.round(pos)
    spans.current.forEach((span, i) => {
      const index = center + i - 2
      const distance = index - pos
      const away = Math.min(Math.abs(distance), 2)
      span.textContent = String(valueAt(index)).padStart(2, '0')
      span.style.transform = `translateY(${distance * ROW}px) rotateX(${-26 * distance}deg) scale(${1 - away * 0.16})`
      span.style.opacity = String(Math.max(0.08, 1 - away * 0.62))
    })
    if (center !== lastIndex.current) {
      const wrapped = Math.abs(valueAt(center) - valueAt(lastIndex.current)) > size / 2
      lastIndex.current = center
      if (wrapped) haptic('medium')
      else hapticTick()
      latest.current.onChange(valueAt(center))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  const animate = useCallback(() => {
    const state = motion.current
    const step = () => {
      if (drag.current) {
        state.raf = 0
        return
      }
      if (state.target === null) {
        state.pos += state.speed
        state.speed *= FRICTION
        if (Math.abs(state.speed) < MIN_SPEED) state.target = Math.round(state.pos)
      } else {
        // Muelle hacia el valor: un pequeño rebote al encajar.
        state.speed = (state.speed + (state.target - state.pos) * 0.16) * 0.72
        state.pos += state.speed
        if (Math.abs(state.target - state.pos) < 0.002 && Math.abs(state.speed) < 0.002) {
          state.pos = state.target
          state.target = null
          state.speed = 0
          paint()
          haptic('light')
          state.raf = 0
          return
        }
      }
      paint()
      state.raf = requestAnimationFrame(step)
    }
    if (!state.raf) state.raf = requestAnimationFrame(step)
  }, [paint])

  useLayoutEffect(paint, [paint])
  useEffect(() => () => cancelAnimationFrame(motion.current.raf), [])

  // Si el valor cambia desde fuera (al escribir "19:30"), la rueda gira sola.
  useEffect(() => {
    const state = motion.current
    if (drag.current || state.target !== null || valueAt(Math.round(state.pos)) === value) return
    const center = Math.round(state.pos)
    const from = ((center % size) + size) % size
    let delta = Math.max(0, values.indexOf(value)) - from
    if (delta > size / 2) delta -= size
    if (delta < -size / 2) delta += size
    state.target = center + delta
    state.speed = 0
    animate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, size])

  // La rueda del ratón no debe mover la página: el listener tiene que ser activo.
  useEffect(() => {
    const element = node.current
    if (!element) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const state = motion.current
      state.target = (state.target ?? Math.round(state.pos)) + Math.sign(e.deltaY)
      state.speed = 0
      animate()
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [animate])

  return (
    <div
      ref={node}
      className="wheel"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuetext={String(value).padStart(2, '0')}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const state = motion.current
        state.target = null
        state.speed = 0
        drag.current = { y: e.clientY, time: e.timeStamp, moved: false }
      }}
      onPointerMove={(e) => {
        const current = drag.current
        if (!current) return
        const dy = e.clientY - current.y
        if (Math.abs(dy) > 1) current.moved = true
        const state = motion.current
        state.pos -= dy / ROW
        state.speed = (-dy / ROW / Math.max(1, e.timeStamp - current.time)) * 16
        current.y = e.clientY
        current.time = e.timeStamp
        paint()
      }}
      onPointerUp={(e) => {
        const current = drag.current
        drag.current = null
        if (!current) return
        const state = motion.current
        if (!current.moved) {
          const box = e.currentTarget.getBoundingClientRect()
          const row = Math.round((e.clientY - box.top - box.height / 2) / ROW)
          if (row === 0) {
            onTapCenter()
            return
          }
          state.target = Math.round(state.pos) + row
          state.speed = 0
        } else {
          state.speed = Math.max(-0.7, Math.min(0.7, state.speed))
          if (Math.abs(state.speed) < MIN_SPEED) state.target = Math.round(state.pos)
        }
        animate()
      }}
      onPointerCancel={() => {
        drag.current = null
        motion.current.target = Math.round(motion.current.pos)
        animate()
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        const state = motion.current
        state.target = (state.target ?? Math.round(state.pos)) + (e.key === 'ArrowUp' ? -1 : 1)
        state.speed = 0
        animate()
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          ref={(el) => {
            if (el) spans.current[i] = el
          }}
        />
      ))}
    </div>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

/** Hora digital con dos ruedas. Tocar el número central abre el teclado para una hora exacta. */
export function TimeWheels({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const [editing, setEditing] = useState(false)
  const latest = useRef(minutes)
  latest.current = minutes
  // Una hora escrita a mano (19:37) entra también en la rueda de 5 en 5.
  const minuteValues = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), minute])].sort((a, b) => a - b)

  return (
    <div className="wheels">
      <div className="wheels__band" aria-hidden="true" />
      {editing ? (
        <input
          className="wheels__input"
          type="time"
          autoFocus
          aria-label="Hora exacta"
          defaultValue={`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
          onBlur={(e) => {
            const [h, m] = e.target.value.split(':').map(Number)
            if (!Number.isNaN(h)) onChange(h * 60 + (m || 0))
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              e.currentTarget.blur()
            }
          }}
        />
      ) : (
        <>
          <Wheel
            values={HOURS}
            value={hour}
            label="Hora"
            onChange={(next) => onChange(next * 60 + (latest.current % 60))}
            onTapCenter={() => setEditing(true)}
          />
          <span className="wheels__colon" aria-hidden="true">:</span>
          <Wheel
            key={minuteValues.length}
            values={minuteValues}
            value={minute}
            label="Minutos"
            onChange={(next) => onChange(Math.floor(latest.current / 60) * 60 + next)}
            onTapCenter={() => setEditing(true)}
          />
        </>
      )}
    </div>
  )
}

/** Tira de 7 días por semanas; al tocar el mes se despliega el mes completo. */
export function DayStrip({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const selected = parseISO(date)
  const [monday, setMonday] = useState(() => startOfWeek(selected))
  const [monthOpen, setMonthOpen] = useState(false)
  const [direction, setDirection] = useState(1)
  const [shownMonth, setShownMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1, 12))
  const today = iso(new Date())
  const swipe = useRef<number | null>(null)

  useEffect(() => {
    const target = startOfWeek(selected)
    if (iso(target) !== iso(monday)) {
      setDirection(target > monday ? 1 : -1)
      setMonday(target)
    }
    setShownMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const shiftWeek = (step: 1 | -1) => {
    hapticTick()
    setDirection(step)
    setMonday((value) => addDays(value, step * 7))
  }
  const pick = (next: string) => {
    if (next !== date) haptic('selection')
    onChange(next)
  }
  const middle = addDays(monday, 3)
  const heading = iso(startOfWeek(selected)) === iso(monday) ? selected : middle

  return (
    <div className="daystrip">
      <div className="daystrip__head">
        <button
          type="button"
          className="daystrip__month"
          aria-expanded={monthOpen}
          onClick={() => {
            haptic('selection')
            setMonthOpen((open) => !open)
          }}
        >
          {MONTHS[heading.getMonth()].replace(/^./, (c) => c.toUpperCase())} {heading.getFullYear()}
          <ChevronDown size={15} strokeWidth={2} className={monthOpen ? 'is-open' : ''} aria-hidden="true" />
        </button>
        <span className="daystrip__nav">
          {date !== today && (
            <button type="button" className="daystrip__today" onClick={() => pick(today)}>
              Hoy
            </button>
          )}
          <button type="button" className="daystrip__arrow" aria-label="Semana anterior" onClick={() => shiftWeek(-1)}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button type="button" className="daystrip__arrow" aria-label="Semana siguiente" onClick={() => shiftWeek(1)}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </span>
      </div>

      <div
        className="daystrip__clip"
        onTouchStart={(e) => {
          swipe.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (swipe.current === null) return
          const dx = e.changedTouches[0].clientX - swipe.current
          swipe.current = null
          if (Math.abs(dx) > 48) shiftWeek(dx < 0 ? 1 : -1)
        }}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <m.div
            key={iso(monday)}
            className="daystrip__week"
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ type: 'spring', stiffness: 460, damping: 38 }}
          >
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(monday, i)
              const key = iso(day)
              return (
                <button
                  key={key}
                  type="button"
                  className={`daystrip__day ${key === date ? 'is-active' : ''} ${key === today ? 'is-today' : ''}`}
                  aria-pressed={key === date}
                  onClick={() => pick(key)}
                >
                  <span>{WEEKDAYS_SHORT[i]}</span>
                  <strong>{day.getDate()}</strong>
                </button>
              )
            })}
          </m.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {monthOpen && (
          <m.div
            className="minimonth"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            <div className="minimonth__head">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => setShownMonth((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1, 12))}
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              </button>
              <span>
                {MONTHS[shownMonth.getMonth()].replace(/^./, (c) => c.toUpperCase())} {shownMonth.getFullYear()}
              </span>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => setShownMonth((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1, 12))}
              >
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="minimonth__grid">
              {WEEKDAYS_MINI.map((label, i) => (
                <span key={i} className="minimonth__dow">
                  {label}
                </span>
              ))}
              {monthMatrix(shownMonth).map((day) => {
                const key = iso(day)
                const inMonth = day.getMonth() === shownMonth.getMonth()
                return (
                  <button
                    key={key}
                    type="button"
                    className={`minimonth__day ${key === date ? 'is-active' : ''} ${key === today ? 'is-today' : ''}`}
                    style={inMonth ? undefined : { visibility: 'hidden' }}
                    tabIndex={inMonth ? 0 : -1}
                    onClick={() => {
                      pick(key)
                      setMonthOpen(false)
                    }}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
