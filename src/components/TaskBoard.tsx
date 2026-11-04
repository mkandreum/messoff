import { useState } from 'react'
import { AnimatePresence, m, useDragControls } from 'motion/react'
import { ChevronLeft, ChevronRight, GripVertical, Trash2 } from 'lucide-react'
import type { Task, TaskStatus } from '../types'
import { iso, parseISO, relativeDay } from '../lib/date'
import { haptic } from '../lib/haptics'
import { teamById, teamHex } from '../lib/teams'
import { usePlanner } from '../state'
import { CalendarPicker } from './CalendarPicker'
import { AssigneePicker } from './TaskRow'

export const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'Por hacer' },
  { id: 'doing', label: 'En curso' },
  { id: 'done', label: 'Hecha' },
]

type Props = {
  tasks: Task[]
  onDelete: (task: Task) => void
}

function Card({ task, onMove, onDelete, setOver }: {
  task: Task
  onMove: (task: Task, status: TaskStatus) => void
  onDelete: (task: Task) => void
  setOver: (status: TaskStatus | null) => void
}) {
  const { teams, theme, user, updateTask } = usePlanner()
  const [open, setOpen] = useState(false)
  const controls = useDragControls()
  const team = teamById(teams, task.teamId)
  const assignee = task.assigneeId === user.id ? 'Yo' : task.assigneeName
  const status = task.status ?? (task.done ? 'done' : 'todo')
  const index = COLUMNS.findIndex((column) => column.id === status)
  const overdue = !!task.due && !task.done && task.due < iso(new Date())

  const columnAt = (e: MouseEvent | TouchEvent | PointerEvent) => {
    const point = 'changedTouches' in e ? e.changedTouches[0] : e
    return document
      .elementsFromPoint(point.clientX, point.clientY)
      .map((el) => (el as HTMLElement).dataset.status)
      .find(Boolean) as TaskStatus | undefined
  }

  return (
    <m.article
      layout="position"
      className={`bcard ${task.done ? 'is-done' : ''}`}
      drag
      dragControls={controls}
      dragListener={false}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={1}
      whileDrag={{ scale: 1.03, rotate: -1.5, zIndex: 30 }}
      onDragStart={() => haptic('medium')}
      onDrag={(e) => setOver(columnAt(e) ?? null)}
      onDragEnd={(e) => {
        setOver(null)
        const target = columnAt(e)
        if (target && target !== status) onMove(task, target)
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 520, damping: 40 }}
    >
      <div className="bcard__top">
        <button
          type="button"
          className="bcard__grip"
          aria-label={`Arrastrar ${task.title} a otra columna`}
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical size={15} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="bcard__title"
          aria-expanded={open}
          onClick={() => {
            haptic('selection')
            setOpen((value) => !value)
          }}
        >
          {task.title}
        </button>
      </div>
      <div className="bcard__meta">
        <i className={`dot dot--${task.tag}`} aria-hidden="true" />
        {task.due && <span className={overdue ? 'is-late' : ''}>{relativeDay(parseISO(task.due))}</span>}
        {team && (
          <span className="ag-team" style={{ ['--c' as string]: teamHex(team.color, theme === 'night') }}>
            <i aria-hidden="true" />
            {team.name}
          </span>
        )}
        {team && <strong>{assignee ?? 'Sin asignar'}</strong>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            className="bcard__edit"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {teams.length > 0 && (
              <CalendarPicker
                label="Dónde vive la tarea"
                value={task.teamId ?? null}
                onChange={(teamId) => updateTask(task.id, { teamId, assigneeId: null })}
                disabled={!!task.authorId && task.authorId !== user.id}
              />
            )}
            <AssigneePicker
              teamId={task.teamId}
              value={task.assigneeId}
              onChange={(assigneeId) => updateTask(task.id, { assigneeId })}
            />
            <div className="bcard__actions">
              <button
                type="button"
                className="bcard__move"
                disabled={index === 0}
                aria-label="Mover a la columna anterior"
                onClick={() => onMove(task, COLUMNS[index - 1].id)}
              >
                <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="bcard__move"
                disabled={index === COLUMNS.length - 1}
                aria-label="Mover a la columna siguiente"
                onClick={() => onMove(task, COLUMNS[index + 1].id)}
              >
                <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
              </button>
              <button type="button" className="task-edit__delete" onClick={() => onDelete(task)}>
                <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                Eliminar
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.article>
  )
}

/** Tablero por estado: se arrastra una tarjeta de una columna a otra. */
export function TaskBoard({ tasks, onDelete }: Props) {
  const { updateTask, notify } = usePlanner()
  const [over, setOver] = useState<TaskStatus | null>(null)

  const move = (task: Task, status: TaskStatus) => {
    const previous = task.status ?? (task.done ? 'done' : 'todo')
    haptic(status === 'done' ? 'success' : 'snap')
    updateTask(task.id, { status })
    notify(`«${task.title}» · ${COLUMNS.find((column) => column.id === status)?.label}`, 'Deshacer', () =>
      updateTask(task.id, { status: previous }),
    )
  }

  return (
    <div className="board">
      {COLUMNS.map((column) => {
        const items = tasks
          .filter((task) => (task.status ?? (task.done ? 'done' : 'todo')) === column.id)
          .sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'))
        return (
          <section key={column.id} className={`board__col ${over === column.id ? 'is-over' : ''}`} data-status={column.id}>
            <h2 className="taskgroup__title">
              {column.label}
              <span>{items.length}</span>
            </h2>
            <AnimatePresence initial={false}>
              {items.map((task) => (
                <Card key={task.id} task={task} onMove={move} onDelete={onDelete} setOver={setOver} />
              ))}
            </AnimatePresence>
            {items.length === 0 && <p className="board__empty">Suelta aquí una tarea</p>}
          </section>
        )
      })}
    </div>
  )
}
