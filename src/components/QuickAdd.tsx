import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import type { Category, RepeatRule } from '../types'
import { CATEGORIES, CATEGORY_LABEL } from '../data'
import { fmtDateLong, fmtDateMedium, fmtTime, parseISO } from '../lib/date'
import { haptic } from '../lib/haptics'
import { useBodyLock, useFocusTrap } from '../lib/focus'
import { parseQuickAdd } from '../lib/parse'
import { REMIND_OPTIONS, REPEAT_OPTIONS } from '../lib/recurrence'
import { askReminderPermission } from '../lib/reminders'
import { usePlanner } from '../state'
import { CalendarPicker } from './CalendarPicker'
import { DayStrip, TimeWheels } from './DateTimePicker'

type Props = {
  open: boolean
  onClose: () => void
  preset: { date: Date; start: number } | null
  onCreated: (id: string) => void
}

const DURATIONS = [30, 45, 60, 90, 120]

export function QuickAdd({ open, onClose, preset, onCreated }: Props) {
  const { addEvent, notify, teams } = usePlanner()
  const [teamId, setTeamId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [manualCategory, setManualCategory] = useState<Category | null>(null)
  const [duration, setDuration] = useState(60)
  // Lo tocado en las ruedas manda sobre el texto, hasta que el texto vuelva a decir un día o una hora.
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const [pickedStart, setPickedStart] = useState<number | null>(null)
  const [repeat, setRepeat] = useState<RepeatRule>('none')
  const [remind, setRemind] = useState<number | null>(10)
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  useFocusTrap(panel, open, onClose)
  useBodyLock(open)

  const parsed = useMemo(
    () => parseQuickAdd(text, new Date(), preset ?? undefined),
    [text, preset],
  )
  const category = manualCategory ?? parsed.category ?? 'trabajo'
  const date = pickedDate ?? parsed.date
  const start = pickedStart ?? parsed.start

  useEffect(() => {
    if (!open) return
    setText('')
    setManualCategory(null)
    setDuration(60)
    setPickedDate(null)
    setPickedStart(null)
    setRepeat('none')
    setRemind(10)
    // Recuerda el último calendario usado si todavía existe.
    let last: string | null = null
    try {
      last = localStorage.getItem('messoff.lastCalendar')
    } catch {
      /* almacenamiento no disponible */
    }
    setTeamId(last && teams.some((team) => team.id === last) ? last : null)
    // Si vienes de tocar un hueco, la hora ya está elegida: en móvil, el teclado taparía las ruedas.
    if (preset && window.matchMedia('(pointer: coarse)').matches) return
    const timer = window.setTimeout(() => input.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [open])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      input.current?.focus()
      return
    }
    const event = addEvent({
      title: parsed.title,
      date,
      start,
      duration,
      category,
      attendees: [],
      checklist: [],
      note: '',
      teamId,
      repeat,
      remind,
    })
    if (remind !== null) void askReminderPermission()
    try {
      localStorage.setItem('messoff.lastCalendar', teamId ?? '')
    } catch {
      /* almacenamiento no disponible */
    }
    haptic('success')
    onClose()
    notify(
      `«${parsed.title}» · ${fmtDateMedium(parseISO(date))} ${fmtTime(start)}`,
      'Abrir',
      () => onCreated(event.id),
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <m.div
            className="quick"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Crear evento"
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 480, damping: 36 }}
          >
            <header className="quick__head">
              <span className="kicker">
                <Sparkles size={12} strokeWidth={1.8} aria-hidden="true" />
                NUEVO EVENTO
              </span>
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>

            <form onSubmit={submit}>
              <input
                ref={input}
                className="quick__input"
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setManualCategory(null)
                  const next = parseQuickAdd(e.target.value, new Date(), preset ?? undefined)
                  if (next.matchedDay) setPickedDate(null)
                  if (next.matchedTime) setPickedStart(null)
                }}
                placeholder="Café con Lucía mañana 09:30"
                aria-label="Escribe el evento en lenguaje natural"
              />

              <div className="quick__when">
                <DayStrip date={date} onChange={setPickedDate} />
                <TimeWheels minutes={start} onChange={setPickedStart} />
                <p className="quick__summary">
                  <span>{fmtDateLong(parseISO(date))}</span>
                  <strong>
                    {fmtTime(start)} – {fmtTime(start + duration)}
                  </strong>
                </p>
              </div>

              <div className="quick__controls">
                <div className="quick__group">
                  <span className="quick__label">Duración</span>
                  <div className="dur-chips">
                    {DURATIONS.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        className={`dur ${duration === minutes ? 'is-active' : ''}`}
                        onClick={() => {
                          haptic('selection')
                          setDuration(minutes)
                        }}
                        aria-pressed={duration === minutes}
                      >
                        {minutes < 60 ? `${minutes}m` : `${String(minutes / 60).replace('.', ',')}h`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="quick__group quick__group--wide">
                  <span className="quick__label">Repetir</span>
                  <div className="dur-chips">
                    {REPEAT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`dur ${repeat === option.id ? 'is-active' : ''}`}
                        aria-pressed={repeat === option.id}
                        onClick={() => {
                          haptic('selection')
                          setRepeat(option.id)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="quick__group quick__group--wide">
                  <span className="quick__label">Aviso</span>
                  <div className="dur-chips">
                    {REMIND_OPTIONS.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        className={`dur ${remind === option.minutes ? 'is-active' : ''}`}
                        aria-pressed={remind === option.minutes}
                        onClick={() => {
                          haptic('selection')
                          setRemind(option.minutes)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {teams.length > 0 && (
                  <div className="quick__group quick__group--wide">
                    <span className="quick__label">Calendario</span>
                    <CalendarPicker value={teamId} onChange={setTeamId} />
                  </div>
                )}

                <div className="quick__group">
                  <span className="quick__label">Categoría</span>
                  <div className="catpick catpick--dots" role="group" aria-label="Categoría">
                    {CATEGORIES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`tagpicker__btn dot--${item} ${
                          category === item ? 'is-active' : ''
                        }`}
                        onClick={() => {
                          haptic('selection')
                          setManualCategory(item)
                        }}
                        aria-label={CATEGORY_LABEL[item]}
                        aria-pressed={category === item}
                        title={CATEGORY_LABEL[item]}
                      >
                        <i aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <footer className="quick__foot">
                <span className="quick__hint">Escribe o desliza: los dos valen.</span>
                <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
                  Crear evento
                  <ArrowRight size={15} strokeWidth={1.9} aria-hidden="true" />
                </button>
              </footer>
            </form>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
