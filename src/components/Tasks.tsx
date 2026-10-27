import { useMemo, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { ArrowRight, Check, Plus } from 'lucide-react'
import type { Category, Task } from '../types'
import { CATEGORIES, CATEGORY_LABEL } from '../data'
import { fmtTime, iso, parseISO, relativeDay } from '../lib/date'
import { haptic } from '../lib/haptics'
import { usePlanner } from '../state'
import { TaskRow } from './TaskRow'

type Filter = 'todas' | 'hoy' | 'semana' | 'hechas'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'hechas', label: 'Hechas' },
]

export function TasksView() {
  const {
    tasks,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    restoreTask,
    scheduleTask,
    unscheduleTask,
    notify,
  } = usePlanner()
  const [filter, setFilter] = useState<Filter>('todas')
  const [draft, setDraft] = useState('')
  const [tag, setTag] = useState<Category>('personal')

  const today = iso(new Date())
  const weekEnd = iso(new Date(Date.now() + 6 * 86400000))

  const pending = tasks.filter((t) => !t.done)
  const completed = tasks.filter((t) => t.done)
  const visible = useMemo(() => {
    const list = filter === 'hechas' ? completed : pending
    if (filter === 'hoy') return list.filter((t) => t.due === today || (t.due && t.due < today))
    if (filter === 'semana')
      return list.filter((t) => t.due && t.due >= today && t.due <= weekEnd)
    return list
  }, [completed, filter, pending, today, weekEnd])

  const groups = useMemo(() => {
    const order = ['Atrasadas', 'Hoy', 'Mañana', 'Esta semana', 'Sin fecha']
    const map = new Map<string, Task[]>()
    for (const task of visible) {
      let key = 'Sin fecha'
      if (task.due) {
        if (task.due < today) key = 'Atrasadas'
        else if (task.due === today) key = 'Hoy'
        else if (task.due === iso(new Date(Date.now() + 86400000))) key = 'Mañana'
        else if (task.due <= weekEnd) key = 'Esta semana'
      }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return order.filter((key) => map.has(key)).map((key) => ({ key, items: map.get(key)! }))
  }, [visible, today, weekEnd])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    addTask(title, today, tag)
    setDraft('')
    haptic('success')
    notify('Tarea añadida a la bandeja')
  }

  const schedule = async (task: Task) => {
    const created = await scheduleTask(task.id)
    if (!created) return
    haptic('success')
    notify(
      `«${task.title}» programada a las ${fmtTime(created.start)}`,
      'Deshacer',
      () => unscheduleTask(created.id, task.id),
    )
  }

  const remove = (task: Task) => {
    const removed = deleteTask(task.id)
    if (!removed) return
    notify(`«${task.title}» eliminada`, 'Deshacer', () => restoreTask(removed))
  }

  const toggle = (id: string) => {
    const task = tasks.find((t) => t.id === id)
    toggleTask(id)
    if (task && !task.done && pending.length === 1) {
      window.setTimeout(() => {
        haptic('celebrate')
        notify('Bandeja vacía. Lo que queda es tiempo tuyo.')
      }, 260)
    }
  }

  const doneCount = completed.length
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

  return (
    <div className="tasksview">
      <div className="tasksview__grid">
        <section className="panel tasksview__main" aria-label="Bandeja de tareas">
          <form className="taskform" onSubmit={submit}>
            <span className="taskform__plus" aria-hidden="true">
              <Plus size={16} strokeWidth={2} />
            </span>
            <input
              id="new-task-input"
              className="taskform__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Añadir algo pequeño, concreto…"
              aria-label="Nueva tarea"
            />
            <div className="tagpicker" role="group" aria-label="Etiqueta de la tarea">
              {CATEGORIES.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={`tagpicker__btn dot--${category} ${tag === category ? 'is-active' : ''}`}
                  onClick={() => {
                    setTag(category)
                    haptic('selection')
                  }}
                  aria-label={CATEGORY_LABEL[category]}
                  aria-pressed={tag === category}
                  title={CATEGORY_LABEL[category]}
                >
                  <i aria-hidden="true" />
                </button>
              ))}
            </div>
            <button type="submit" className="taskform__submit" disabled={!draft.trim()}>
              Añadir
            </button>
          </form>

          <div className="filters" role="tablist" aria-label="Filtrar tareas">
            {FILTERS.map((item) => {
              const active = filter === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`filter ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    haptic('selection')
                    setFilter(item.id)
                  }}
                >
                  {active && (
                    <m.span
                      layoutId="filter-indicator"
                      className="filter__indicator"
                      transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                    />
                  )}
                  <span>{item.label}</span>
                  {item.id === 'todas' && <em>{pending.length}</em>}
                  {item.id === 'hechas' && <em>{completed.length}</em>}
                </button>
              )
            })}
          </div>

          <div className="tasks tasks--full">
            {groups.length === 0 && (
              <div className="empty">
                <span className="empty__mark" aria-hidden="true">✓</span>
                <p className="empty__title">Nada por aquí.</p>
                <p className="empty__copy">
                  {filter === 'hechas'
                    ? 'Aún no has cerrado nada. Todo llega.'
                    : 'La bandeja está en calma. Disfruta el hueco.'}
                </p>
              </div>
            )}
            {groups.map((group) => (
              <section className="taskgroup" key={group.key}>
                <h2 className="taskgroup__title">
                  {group.key}
                  <span>{group.items.length}</span>
                </h2>
                <AnimatePresence initial={false}>
                  {group.items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={toggle}
                      onSchedule={schedule}
                      onDelete={remove}
                      onUpdate={updateTask}
                      showTag={false}
                    />
                  ))}
                </AnimatePresence>
              </section>
            ))}
          </div>

          <footer className="tasksview__foot">
            <div className="progress" aria-hidden="true">
              <m.i
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', stiffness: 220, damping: 30 }}
              />
            </div>
            <span>
              {doneCount} de {tasks.length} {tasks.length === 1 ? 'completada' : 'completadas'} ·{' '}
              {progress}%
            </span>
          </footer>
        </section>

        <aside className="tasksview__side">
          <section className="panel panel--tight" aria-label="Resumen">
            <header className="panel__head">
              <h2 className="panel__title">La semana en tareas</h2>
            </header>
            <div className="mini-stats">
              <div>
                <span>Pendientes</span>
                <strong>{pending.length}</strong>
              </div>
              <div>
                <span>Atrasadas</span>
                <strong>{pending.filter((t) => t.due && t.due < today).length}</strong>
              </div>
              <div>
                <span>Hechas</span>
                <strong>{completed.length}</strong>
              </div>
            </div>
            <p className="mini-note">
              <Check size={13} strokeWidth={2} aria-hidden="true" />
              Desliza a la derecha para completar, a la izquierda para eliminar. Toca una tarea para editarla.
            </p>
          </section>

          <section className="panel panel--tight" aria-label="Próximos vencimientos">
            <header className="panel__head">
              <h2 className="panel__title">Se acerca</h2>
              <button type="button" className="link" onClick={() => setFilter('semana')}>
                Ver semana <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>
            <ul className="due-list">
              {pending
                .filter((t) => t.due)
                .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
                .slice(0, 4)
                .map((task) => (
                  <li key={task.id}>
                    <span className={`dot dot--${task.tag}`} aria-hidden="true" />
                    <span>{task.title}</span>
                    <em>{relativeDay(parseISO(task.due!))}</em>
                  </li>
                ))}
              {pending.filter((t) => t.due).length === 0 && (
                <li className="due-list__empty">Sin fechas a la vista.</li>
              )}
            </ul>
          </section>

          <section className="panel panel--tight panel--muted" aria-label="Cómo funciona">
            <p className="kicker">ATAJOS</p>
            <ul className="keylist">
              <li><kbd>N</kbd> Nuevo evento</li>
              <li><kbd>⌘</kbd><kbd>K</kbd> Buscar o navegar</li>
              <li><kbd>←</kbd><kbd>→</kbd> Cambiar semana</li>
              <li><kbd>Esc</kbd> Cerrar cualquier capa</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
