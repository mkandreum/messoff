import { motion } from 'motion/react'
import { CalendarPlus, Check } from 'lucide-react'
import type { Task } from '../types'
import { iso, relativeDay, parseISO } from '../lib/date'
import { CATEGORY_LABEL } from '../data'
import { haptic } from '../lib/haptics'

type Props = {
  task: Task
  onToggle: (id: string) => void
  onSchedule?: (task: Task) => void
  showTag?: boolean
}

export function TaskRow({ task, onToggle, onSchedule, showTag = true }: Props) {
  const dueDate = task.due ? parseISO(task.due) : null
  const overdue = !!task.due && !task.done && task.due < iso(new Date())
  const dueLabel = dueDate ? relativeDay(dueDate) : 'Sin fecha'

  return (
    <div className={`task ${task.done ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}`}>
      <button
        type="button"
        className="task__check"
        role="checkbox"
        aria-checked={task.done}
        aria-label={`${task.done ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${task.title}`}
        onClick={() => {
          haptic(task.done ? 'light' : 'success')
          onToggle(task.id)
        }}
      >
        <motion.span
          className="task__box"
          animate={{ scale: task.done ? 1 : 0.92, backgroundColor: task.done ? 'var(--ink)' : 'transparent' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          {task.done && <Check size={12} strokeWidth={3} aria-hidden="true" />}
        </motion.span>
      </button>

      <div className="task__main">
        <span className="task__title">{task.title}</span>
        <span className="task__meta">
          <span className={`task__due ${overdue ? 'is-late' : ''}`}>
            <i className={`dot dot--${task.tag}`} aria-hidden="true" />
            {dueLabel}
            {showTag && <em>· {CATEGORY_LABEL[task.tag]}</em>}
          </span>
        </span>
      </div>

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
    </div>
  )
}
