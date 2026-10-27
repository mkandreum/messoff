import { useRef, useState } from 'react'
import { AnimatePresence, m, useMotionValue, useTransform } from 'motion/react'
import { CalendarPlus, Check, Trash2 } from 'lucide-react'
import type { Task } from '../types'
import { addDays, iso, parseISO, relativeDay } from '../lib/date'
import { CATEGORIES, CATEGORY_LABEL } from '../data'
import { haptic } from '../lib/haptics'

type Props = {
  task: Task
  onToggle: (id: string) => void
  onSchedule?: (task: Task) => void
  onDelete?: (task: Task) => void
  onUpdate?: (id: string, patch: Partial<Pick<Task, 'title' | 'due' | 'tag'>>) => void
  showTag?: boolean
}

const THRESHOLD = 76

export function TaskRow({ task, onToggle, onSchedule, onDelete, onUpdate, showTag = true }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const x = useMotionValue(0)
  const armed = useRef<0 | 1 | -1>(0)
  const dragged = useRef(false)
  const doneOpacity = useTransform(x, [12, THRESHOLD], [0, 1])
  const deleteOpacity = useTransform(x, [-THRESHOLD, -12], [1, 0])
  const iconScale = useTransform(x, [-THRESHOLD - 30, -THRESHOLD, 0, THRESHOLD, THRESHOLD + 30], [1.15, 1, 0.6, 1, 1.15])

  const today = iso(new Date())
  const dueDate = task.due ? parseISO(task.due) : null
  const overdue = !!task.due && !task.done && task.due < today
  const dueLabel = dueDate ? relativeDay(dueDate) : 'Sin fecha'
  const swipeable = !!onDelete

  const toggle = () => {
    haptic(task.done ? 'light' : 'success')
    onToggle(task.id)
  }

  const commitTitle = () => {
    const next = title.replace(/\s+/g, ' ').trim()
    if (next && next !== task.title) onUpdate?.(task.id, { title: next })
    else setTitle(task.title)
  }

  const setDue = (due: string | null) => {
    haptic('selection')
    onUpdate?.(task.id, { due })
  }

  return (
    <m.div
      className="task-wrap"
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 40 }}
    >
      {swipeable && (
        <div className="task-swipe" aria-hidden="true">
          <m.span className="task-swipe__done" style={{ opacity: doneOpacity }}>
            <m.span style={{ scale: iconScale }}>
              <Check size={16} strokeWidth={2.4} />
            </m.span>
            {task.done ? 'Pendiente' : 'Hecha'}
          </m.span>
          <m.span className="task-swipe__delete" style={{ opacity: deleteOpacity }}>
            Eliminar
            <m.span style={{ scale: iconScale }}>
              <Trash2 size={16} strokeWidth={2} />
            </m.span>
          </m.span>
        </div>
      )}

      <m.div
        className={`task ${task.done ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''} ${
          editing ? 'is-editing' : ''
        }`}
        style={{ x }}
        drag={swipeable && !editing ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        dragSnapToOrigin
        onDragStart={() => {
          dragged.current = true
          armed.current = 0
        }}
        onDrag={(_, info) => {
          const next = info.offset.x > THRESHOLD ? 1 : info.offset.x < -THRESHOLD ? -1 : 0
          if (next !== armed.current) {
            armed.current = next
            haptic(next === 0 ? 'tick' : 'swipe')
          }
        }}
        onDragEnd={() => {
          const action = armed.current
          armed.current = 0
          window.setTimeout(() => {
            dragged.current = false
          }, 60)
          if (action === 1) toggle()
          else if (action === -1) {
            haptic('error')
            onDelete?.(task)
          }
        }}
      >
        <button
          type="button"
          className="task__check"
          role="checkbox"
          aria-checked={task.done}
          aria-label={`${task.done ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${task.title}`}
          onClick={toggle}
        >
          <m.span
            className="task__box"
            animate={{
              scale: task.done ? [1, 1.25, 1] : 0.92,
              backgroundColor: task.done ? 'var(--ink)' : 'rgba(0,0,0,0)',
            }}
            transition={{ duration: 0.32, ease: [0.22, 0.8, 0.3, 1] }}
          >
            <AnimatePresence>
              {task.done && (
                <m.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 26 }}
                  style={{ display: 'grid' }}
                >
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </m.span>
              )}
            </AnimatePresence>
          </m.span>
        </button>

        <button
          type="button"
          className="task__main"
          onClick={() => {
            if (dragged.current || !onUpdate) return
            haptic('selection')
            setTitle(task.title)
            setEditing((value) => !value)
          }}
          aria-expanded={onUpdate ? editing : undefined}
          aria-label={onUpdate ? `Editar ${task.title}` : task.title}
        >
          <span className="task__title">{task.title}</span>
          <span className="task__meta">
            <span className={`task__due ${overdue ? 'is-late' : ''}`}>
              <i className={`dot dot--${task.tag}`} aria-hidden="true" />
              {dueLabel}
              {showTag && <em>· {CATEGORY_LABEL[task.tag]}</em>}
            </span>
          </span>
        </button>

        {onSchedule && !task.done && (
          <button
            type="button"
            className="task__schedule"
            onClick={() => {
              haptic('selection')
              onSchedule(task)
            }}
            aria-label={`Programar en el calendario: ${task.title}`}
            title="Programar en el calendario"
          >
            <CalendarPlus size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>
        )}
      </m.div>

      <AnimatePresence initial={false}>
        {editing && onUpdate && (
          <m.div
            className="task-edit"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 460, damping: 40 }}
          >
            <div className="task-edit__inner">
              <input
                className="task-edit__title"
                value={title}
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitTitle()
                    setEditing(false)
                  } else if (e.key === 'Escape') {
                    setTitle(task.title)
                    setEditing(false)
                  }
                }}
                aria-label="Título de la tarea"
              />
              <div className="task-edit__row" role="group" aria-label="Vencimiento">
                {[
                  { label: 'Hoy', value: today },
                  { label: 'Mañana', value: iso(addDays(new Date(), 1)) },
                  { label: '+1 semana', value: iso(addDays(new Date(), 7)) },
                  { label: 'Sin fecha', value: null },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`chip ${task.due === option.value ? 'is-active' : ''}`}
                    onClick={() => setDue(option.value)}
                    aria-pressed={task.due === option.value}
                  >
                    {option.label}
                  </button>
                ))}
                <input
                  type="date"
                  className="chip chip--date"
                  value={task.due ?? ''}
                  onChange={(e) => setDue(e.target.value || null)}
                  aria-label="Elegir fecha"
                />
              </div>
              <div className="task-edit__row">
                <div className="tagpicker" role="group" aria-label="Etiqueta">
                  {CATEGORIES.map((category) => (
                    <button
                      type="button"
                      key={category}
                      className={`tagpicker__btn dot--${category} ${
                        task.tag === category ? 'is-active' : ''
                      }`}
                      onClick={() => {
                        haptic('selection')
                        onUpdate(task.id, { tag: category })
                      }}
                      aria-label={CATEGORY_LABEL[category]}
                      aria-pressed={task.tag === category}
                      title={CATEGORY_LABEL[category]}
                    >
                      <i aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {onDelete && (
                  <button
                    type="button"
                    className="task-edit__delete"
                    onClick={() => {
                      haptic('error')
                      onDelete(task)
                    }}
                  >
                    <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                    Eliminar
                  </button>
                )}
                <button
                  type="button"
                  className="task-edit__done"
                  onClick={() => {
                    commitTitle()
                    setEditing(false)
                  }}
                >
                  Listo
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  )
}
