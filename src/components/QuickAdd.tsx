import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { ArrowRight, CalendarDays, Clock3, CornerDownLeft, Sparkles, X } from 'lucide-react'
import type { Category } from '../types'
import { CATEGORIES, CATEGORY_LABEL } from '../data'
import { fmtDateLong, fmtTime, parseISO } from '../lib/date'
import { haptic } from '../lib/haptics'
import { useBodyLock, useFocusTrap } from '../lib/focus'
import { parseQuickAdd } from '../lib/parse'
import { usePlanner } from '../state'
import { CalendarPicker } from './CalendarPicker'

type Props = {
  open: boolean
  onClose: () => void
  preset: { date: Date; start: number } | null
  onCreated: (id: string) => void
}

const EXAMPLES = [
  'Café con Lucía mañana 09:30',
  'Gimnasio viernes 18:00',
  'Revisar OKR hoy 16:30',
  'Cena con Ana sábado 21:00',
]

const DURATIONS = [30, 45, 60, 90, 120]

export function QuickAdd({ open, onClose, preset, onCreated }: Props) {
  const { addEvent, notify, teams } = usePlanner()
  const [teamId, setTeamId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [manualCategory, setManualCategory] = useState<Category | null>(null)
  const [duration, setDuration] = useState(60)
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  useFocusTrap(panel, open, onClose)
  useBodyLock(open)

  const parsed = useMemo(
    () => parseQuickAdd(text, new Date(), preset ?? undefined),
    [text, preset],
  )
  const category = manualCategory ?? parsed.category ?? 'trabajo'

  useEffect(() => {
    if (!open) return
    setText('')
    setManualCategory(null)
    setDuration(60)
    // Recuerda el último calendario usado si todavía existe.
    let last: string | null = null
    try {
      last = localStorage.getItem('messoff.lastCalendar')
    } catch {
      /* almacenamiento no disponible */
    }
    setTeamId(last && teams.some((team) => team.id === last) ? last : null)
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
      date: parsed.date,
      start: parsed.start,
      duration,
      category,
      attendees: [],
      checklist: [],
      note: '',
      teamId,
    })
    try {
      localStorage.setItem('messoff.lastCalendar', teamId ?? '')
    } catch {
      /* almacenamiento no disponible */
    }
    haptic('success')
    onClose()
    notify(
      `«${parsed.title}» · ${fmtTime(parsed.start)}`,
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
                }}
                placeholder="Café con Lucía mañana 09:30"
                aria-label="Escribe el evento en lenguaje natural"
              />

              <div className="quick__preview">
                <span className="quick__previewrow">
                  <CalendarDays size={15} strokeWidth={1.7} aria-hidden="true" />
                  {fmtDateLong(parseISO(parsed.date))}
                </span>
                <span className="quick__previewrow">
                  <Clock3 size={15} strokeWidth={1.7} aria-hidden="true" />
                  {fmtTime(parsed.start)} – {fmtTime(parsed.start + duration)}
                </span>
                <span className="quick__previewrow quick__previewrow--muted">
                  <i className={`dot dot--${category}`} aria-hidden="true" />
                  {CATEGORY_LABEL[category]}
                </span>
              </div>

              <div className="quick__examples" aria-label="Ejemplos">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="quick__example"
                    onClick={() => {
                      setText(example)
                      haptic('selection')
                      input.current?.focus()
                    }}
                  >
                    {example}
                  </button>
                ))}
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
                <span className="quick__hint">
                  <CornerDownLeft size={13} strokeWidth={1.8} aria-hidden="true" />
                  Escribe la hora y el día; nosotros ordenamos el resto.
                </span>
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
