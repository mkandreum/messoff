import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  CalendarDays,
  ListChecks,
  Moon,
  Plus,
  Search,
  Sun,
  Timer,
} from 'lucide-react'
import type { View } from '../types'
import { fmtDateMedium, fmtTime } from '../lib/date'
import { haptic } from '../lib/haptics'
import { useBodyLock, useFocusTrap } from '../lib/focus'
import { usePlanner } from '../state'

type Props = {
  open: boolean
  onClose: () => void
  onNavigate: (view: View) => void
  onNewEvent: () => void
  onNewTask: () => void
  onOpenEvent: (id: string) => void
}

type Item = {
  key: string
  group: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onNewEvent,
  onNewTask,
  onOpenEvent,
}: Props) {
  const { events, tasks, theme, setTheme } = usePlanner()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useFocusTrap(panel, open, onClose)
  useBodyLock(open)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    const timer = window.setTimeout(() => input.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open])

  const run = (item: Item) => {
    haptic('selection')
    onClose()
    window.setTimeout(() => item.run(), 20)
  }

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = [
      { id: 'hoy' as View, label: 'Ir a Hoy', icon: <Sun size={16} strokeWidth={1.8} /> },
      {
        id: 'calendario' as View,
        label: 'Ir al calendario',
        icon: <CalendarDays size={16} strokeWidth={1.8} />,
      },
      {
        id: 'tareas' as View,
        label: 'Ir a la bandeja',
        icon: <ListChecks size={16} strokeWidth={1.8} />,
      },
      { id: 'enfoque' as View, label: 'Ir a Enfoque', icon: <Timer size={16} strokeWidth={1.8} /> },
    ].map((item) => ({
      key: `nav-${item.id}`,
      group: 'Navegar',
      label: item.label,
      icon: item.icon,
      run: () => onNavigate(item.id),
    }))

    const actions: Item[] = [
      {
        key: 'new-event',
        group: 'Acciones',
        label: 'Crear evento',
        hint: 'N',
        icon: <Plus size={16} strokeWidth={2} />,
        run: onNewEvent,
      },
      {
        key: 'new-task',
        group: 'Acciones',
        label: 'Añadir tarea a la bandeja',
        icon: <ListChecks size={16} strokeWidth={1.8} />,
        run: onNewTask,
      },
      {
        key: 'theme',
        group: 'Acciones',
        label: theme === 'paper' ? 'Cambiar a modo noche' : 'Cambiar a modo papel',
        icon:
          theme === 'paper' ? (
            <Moon size={16} strokeWidth={1.8} />
          ) : (
            <Sun size={16} strokeWidth={1.8} />
          ),
        run: () => {
          setTheme(theme === 'paper' ? 'night' : 'paper')
          haptic('light')
        },
      },
    ]

    const eventItems: Item[] = events
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
      .map((event) => ({
        key: `event-${event.id}`,
        group: 'Eventos',
        label: event.title,
        hint: `${fmtDateMedium(new Date(`${event.date}T12:00:00`))} · ${fmtTime(event.start)}`,
        icon: <i className={`dot dot--${event.category}`} aria-hidden="true" />,
        run: () => onOpenEvent(event.id),
      }))

    const taskItems: Item[] = tasks
      .filter((task) => !task.done)
      .map((task) => ({
        key: `task-${task.id}`,
        group: 'Tareas',
        label: task.title,
        hint: task.due ? fmtDateMedium(new Date(`${task.due}T12:00:00`)) : 'Sin fecha',
        icon: <i className={`dot dot--${task.tag}`} aria-hidden="true" />,
        run: onNewTask,
      }))

    const all = [...nav, ...actions, ...eventItems, ...taskItems]
    const q = query.trim().toLowerCase()
    const filtered = q
      ? all.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.hint ?? '').toLowerCase().includes(q) ||
            item.group.toLowerCase().includes(q),
        )
      : [
          ...nav,
          ...actions,
          ...eventItems.filter((_, i) => i < 3),
          ...taskItems.filter((_, i) => i < 2),
        ]
    return filtered.slice(0, 14)
  }, [events, tasks, query, theme, setTheme, onNavigate, onNewEvent, onNewTask, onOpenEvent])

  useEffect(() => {
    setIndex((value) => Math.min(value, Math.max(items.length - 1, 0)))
  }, [items.length])

  useEffect(() => {
    if (!open) return
    const node = panel.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [index, open])

  const active = items[index]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            className="palette"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Buscar en Pulso"
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -4 }}
            transition={{ type: 'spring', stiffness: 520, damping: 38 }}
          >
            <div className="palette__inputrow">
              <Search size={18} strokeWidth={1.8} aria-hidden="true" />
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setIndex(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setIndex((i) => Math.min(items.length - 1, i + 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setIndex((i) => Math.max(0, i - 1))
                  } else if (e.key === 'Enter' && active) {
                    e.preventDefault()
                    run(active)
                  }
                }}
                placeholder="Buscar eventos, tareas o secciones…"
                aria-label="Buscar"
                aria-controls="palette-list"
                aria-activedescendant={active ? `pal-${active.key}` : undefined}
              />
              <kbd className="kbd">esc</kbd>
            </div>

            <div className="palette__list" id="palette-list" role="listbox" aria-label="Resultados">
              {items.length === 0 && (
                <p className="palette__empty">Nada coincide con «{query}».</p>
              )}
              {items.map((item, i) => {
                const showGroup = i === 0 || items[i - 1]?.group !== item.group
                return (
                  <div key={item.key}>
                    {showGroup && <p className="palette__group">{item.group}</p>}
                    <button
                      type="button"
                      id={`pal-${item.key}`}
                      data-idx={i}
                      role="option"
                      aria-selected={i === index}
                      className={`palette__item ${i === index ? 'is-active' : ''}`}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => run(item)}
                    >
                      <span className="palette__icon">{item.icon}</span>
                      <span className="palette__label">{item.label}</span>
                      {item.hint && <span className="palette__hint">{item.hint}</span>}
                      {i === index && (
                        <ArrowRight
                          className="palette__arrow"
                          size={14}
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>

            <footer className="palette__foot">
              <span>
                <kbd className="kbd">↑</kbd>
                <kbd className="kbd">↓</kbd> moverse
              </span>
              <span>
                <kbd className="kbd">↵</kbd> abrir
              </span>
              <span className="palette__brand">pulso</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
