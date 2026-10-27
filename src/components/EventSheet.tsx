import { useEffect, useRef, useState } from 'react'
import { m, useDragControls } from 'motion/react'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  GripVertical,
  MapPin,
  Plus,
  Repeat2,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import type { CalEvent, Category } from '../types'
import { CATEGORIES, CATEGORY_LABEL } from '../data'
import {
  addDays,
  fmtDateLong,
  fmtDuration,
  fmtTime,
  iso,
  parseISO,
  relativeDay,
} from '../lib/date'
import { overlaps } from '../lib/grid'
import { haptic } from '../lib/haptics'
import { useBodyLock, useFocusTrap } from '../lib/focus'
import { clampEvent, usePlanner } from '../state'
import { AvatarStack, CategoryTag, initials } from './ui'

type Props = {
  event: CalEvent
  onClose: () => void
  onSelect: (id: string) => void
}

const DURATIONS = [15, 30, 45, 60, 90, 120]

/** Días laborables que quedan en la semana del evento (lunes = 1). */
const restOfWeek = (date: string) => {
  const dow = (parseISO(date).getDay() + 6) % 7
  return Array.from({ length: Math.max(0, 4 - dow) }, (_, i) => i + 1)
}

export function EventSheet({ event, onClose, onSelect }: Props) {
  const {
    events,
    saveEvent,
    deleteEvent,
    duplicateEvent,
    restoreEvent,
    addEvent,
    notify,
  } = usePlanner()
  const dragControls = useDragControls()
  const [draft, setDraft] = useState(event)
  const [newItem, setNewItem] = useState('')
  const [newPerson, setNewPerson] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  useFocusTrap(panel, true, onClose)
  useBodyLock(true)

  useEffect(() => {
    setDraft(event)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  const patch = (partial: Partial<CalEvent>) => {
    const next = clampEvent({ ...draft, ...partial })
    setDraft(next)
    saveEvent(next)
  }

  const conflict = events.find(
    (other) =>
      other.id !== draft.id &&
      overlaps(draft, other),
  )

  const checked = draft.checklist?.filter((item) => item.done).length ?? 0
  const total = draft.checklist?.length ?? 0
  const checkPct = total ? Math.round((checked / total) * 100) : 0

  const moveTo = (date: Date) => {
    const next = iso(date)
    if (next === draft.date) return
    haptic('snap')
    patch({ date: next })
  }

  const repeat = (label: string, offsets: number[]) => {
    const base = parseISO(draft.date)
    const { id: _id, ...rest } = draft
    for (const offset of offsets) {
      addEvent({
        ...rest,
        date: iso(addDays(base, offset)),
        checklist: (draft.checklist ?? []).map((item) => ({
          ...item,
          id: crypto.randomUUID(),
          done: false,
        })),
      })
    }
    haptic('success')
    notify(`Repetido ${label}`)
  }

  const toggleItem = (id: string, done: boolean) => {
    const next = (draft.checklist ?? []).map((item) =>
      item.id === id ? { ...item, done: !done } : item,
    )
    patch({ checklist: next })
    haptic(done ? 'light' : 'success')
  }

  const addItem = (e: React.FormEvent) => {
    e.preventDefault()
    const text = newItem.trim()
    if (!text) return
    patch({
      checklist: [
        ...(draft.checklist ?? []),
        { id: crypto.randomUUID(), text, done: false },
      ],
    })
    setNewItem('')
    haptic('light')
  }

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newPerson.trim()
    if (!name || draft.attendees?.includes(name)) return
    patch({ attendees: [...(draft.attendees ?? []), name] })
    setNewPerson('')
    haptic('light')
  }

  const remove = () => {
    const removed = deleteEvent(draft.id)
    haptic('error')
    onClose()
    notify('Evento eliminado', 'Deshacer', () => {
      if (removed) restoreEvent(removed)
    })
  }

  const duplicate = async () => {
    const copy = await duplicateEvent(draft.id)
    if (!copy) return
    haptic('success')
    onSelect(copy.id)
    notify('Evento duplicado')
  }

  return (
    <m.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <m.div
        ref={panel}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalles de ${draft.title || 'evento'}`}
        layoutId={`ev-${event.id}`}
        transition={{ type: 'spring', stiffness: 480, damping: 38, mass: 0.9 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 650) {
            haptic('swipe')
            onClose()
          }
        }}
      >
        <div
          className="sheet__grabber"
          onPointerDown={(e) => dragControls.start(e)}
          aria-hidden="true"
        >
          <i />
        </div>
        <span className={`sheet__accent sheet__accent--${draft.category}`} aria-hidden="true" />

        <header className="sheet__bar">
          <CategoryTag category={draft.category} />
          <div className="sheet__barright">
            <span className="sheet__saved">
              <Check size={12} strokeWidth={2.4} aria-hidden="true" />
              Guardado
            </span>
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={() => void duplicate()}
              aria-label="Duplicar evento"
              title="Duplicar"
            >
              <Copy size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="sheet__scroll">
          <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.04 }}
          >
            <p className="sheet__kicker">
              {fmtDateLong(parseISO(draft.date))} · {relativeDay(parseISO(draft.date))}
            </p>
            <input
              id="sheet-title-input"
              className="sheet__title"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              aria-label="Título del evento"
              placeholder="Sin título"
            />

            {conflict && (
              <p className="sheet__conflict">
                <AlertTriangle size={14} strokeWidth={1.9} aria-hidden="true" />
                Se solapa con «{conflict.title}» · {fmtTime(conflict.start)}
              </p>
            )}

            <div className="sheet__facts">
              <label className="fact">
                <CalendarDays size={16} strokeWidth={1.7} aria-hidden="true" />
                <span className="fact__body">
                  <span className="fact__label">Fecha</span>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => e.target.value && patch({ date: e.target.value })}
                  />
                </span>
              </label>
              <label className="fact">
                <Clock3 size={16} strokeWidth={1.7} aria-hidden="true" />
                <span className="fact__body">
                  <span className="fact__label">
                    Hora · termina a las {fmtTime(draft.start + draft.duration)}
                  </span>
                  <span className="fact__inline">
                    <input
                      type="time"
                      value={fmtTime(draft.start)}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(':').map(Number)
                        if (!Number.isNaN(h)) patch({ start: h * 60 + (m || 0) })
                      }}
                    />
                    <span className="fact__dur">{fmtDuration(draft.duration)}</span>
                  </span>
                </span>
              </label>
            </div>

            <div className="sheet__section">
              <span className="sheet__label">Duración</span>
              <div className="dur-chips">
                {DURATIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`dur ${draft.duration === minutes ? 'is-active' : ''}`}
                    onClick={() => {
                      haptic('selection')
                      patch({ duration: minutes })
                    }}
                    aria-pressed={draft.duration === minutes}
                  >
                    {minutes < 60 ? `${minutes} min` : `${String(minutes / 60).replace('.', ',')} h`}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet__section">
              <span className="sheet__label">Mover a</span>
              <div className="move-chips">
                <button type="button" className="move" onClick={() => moveTo(new Date())}>
                  Hoy
                </button>
                <button
                  type="button"
                  className="move"
                  onClick={() => moveTo(addDays(new Date(), 1))}
                >
                  Mañana
                </button>
                <button
                  type="button"
                  className="move"
                  onClick={() => moveTo(addDays(parseISO(draft.date), 7))}
                >
                  +1 semana
                </button>
                <span className="move__hint">
                  <GripVertical size={13} strokeWidth={1.8} aria-hidden="true" />
                  o arrastra la tarjeta
                </span>
              </div>
            </div>

            <div className="sheet__section">
              <span className="sheet__label">
                <Repeat2 size={13} strokeWidth={1.8} aria-hidden="true" /> Repetir
              </span>
              <div className="move-chips">
                <button
                  type="button"
                  className="move move--solid"
                  onClick={() => repeat('mañana también', [1])}
                >
                  Al día siguiente
                </button>
                <button
                  type="button"
                  className="move move--solid"
                  onClick={() => repeat('el resto de la semana', restOfWeek(draft.date))}
                  disabled={restOfWeek(draft.date).length === 0}
                >
                  Resto de la semana
                </button>
                <button
                  type="button"
                  className="move move--solid"
                  onClick={() => repeat('4 semanas más', [7, 14, 21, 28])}
                >
                  4 semanas
                </button>
              </div>
            </div>

            <div className="sheet__section">
              <span className="sheet__label">Categoría</span>
              <div className="catpick">
                {CATEGORIES.map((category: Category) => (
                  <button
                    key={category}
                    type="button"
                    className={`catpick__btn catpick__btn--${category} ${
                      draft.category === category ? 'is-active' : ''
                    }`}
                    onClick={() => {
                      haptic('selection')
                      patch({ category })
                    }}
                    aria-pressed={draft.category === category}
                  >
                    <i aria-hidden="true" />
                    {CATEGORY_LABEL[category]}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet__section">
              <label className="sheet__label" htmlFor="sheet-place">
                Ubicación
              </label>
              <div className="sheet__inputrow">
                <MapPin size={16} strokeWidth={1.7} aria-hidden="true" />
                <input
                  id="sheet-place"
                  value={draft.location ?? ''}
                  onChange={(e) => patch({ location: e.target.value })}
                  placeholder="Añadir un lugar"
                />
              </div>
            </div>

            <div className="sheet__section">
              <div className="sheet__labelrow">
                <span className="sheet__label">
                  <Users size={13} strokeWidth={1.8} aria-hidden="true" /> Personas
                </span>
                <span className="sheet__count">{draft.attendees?.length ?? 0}</span>
              </div>
              <div className="people">
                {(draft.attendees ?? []).map((name) => (
                  <span className="person" key={name}>
                    <span className="person__avatar">{initials(name)}</span>
                    {name}
                    <button
                      type="button"
                      className="person__remove"
                      aria-label={`Quitar a ${name}`}
                      onClick={() =>
                        patch({
                          attendees: (draft.attendees ?? []).filter((n) => n !== name),
                        })
                      }
                    >
                      <X size={11} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <form className="person-add" onSubmit={addPerson}>
                  <input
                    value={newPerson}
                    onChange={(e) => setNewPerson(e.target.value)}
                    placeholder="+ Añadir persona"
                    aria-label="Añadir persona"
                  />
                </form>
              </div>
            </div>

            <div className="sheet__section">
              <div className="sheet__labelrow">
                <span className="sheet__label">Subtareas</span>
                <span className="sheet__count">
                  {checked}/{total}
                </span>
              </div>
              {total > 0 && (
                <div className="checkprogress" aria-hidden="true">
                  <i style={{ width: `${checkPct}%` }} />
                </div>
              )}
              <ul className="checklist">
                {(draft.checklist ?? []).map((item) => (
                  <li key={item.id} className={item.done ? 'is-done' : ''}>
                    <button
                      type="button"
                      className="check__box"
                      role="checkbox"
                      aria-checked={item.done}
                      aria-label={item.text}
                      onClick={() => toggleItem(item.id, item.done)}
                    >
                      {item.done && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                    </button>
                    <span>{item.text}</span>
                    <button
                      type="button"
                      className="check__remove"
                      aria-label={`Eliminar subtarea ${item.text}`}
                      onClick={() =>
                        patch({
                          checklist: (draft.checklist ?? []).filter((c) => c.id !== item.id),
                        })
                      }
                    >
                      <X size={12} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <form className="check__add" onSubmit={addItem}>
                <Plus size={14} strokeWidth={2} aria-hidden="true" />
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Añadir subtarea y pulsar Enter"
                  aria-label="Nueva subtarea"
                />
              </form>
            </div>

            <div className="sheet__section">
              <label className="sheet__label" htmlFor="sheet-notes">
                Notas
              </label>
              <textarea
                id="sheet-notes"
                className="sheet__notes"
                value={draft.note ?? ''}
                onChange={(e) => patch({ note: e.target.value })}
                rows={3}
                placeholder="Contexto, acuerdos, lo que no quieres olvidar…"
              />
            </div>

            <p className="sheet__footnote">
              Todo se guarda solo. Tus datos viven en tu cuenta.
            </p>
          </m.div>
        </div>

        <footer className="sheet__foot">
          <button type="button" className="btn btn--danger-ghost" onClick={remove}>
            <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
            Eliminar
          </button>
          <div className="sheet__footright">
            <AvatarStack names={draft.attendees ?? []} max={3} />
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Listo
            </button>
          </div>
        </footer>
      </m.div>
    </m.div>
  )
}
