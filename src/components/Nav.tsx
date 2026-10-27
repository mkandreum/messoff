import { m } from 'motion/react'
import { CalendarDays, ListChecks, Plus, SunMedium, Timer } from 'lucide-react'
import type { View } from '../types'
import { haptic } from '../lib/haptics'
import { Logo } from './ui'

type Props = {
  view: View
  onNavigate: (view: View) => void
  onNew: () => void
}

const ITEMS = [
  { id: 'hoy' as const, label: 'Hoy', icon: SunMedium },
  { id: 'calendario' as const, label: 'Calendario', icon: CalendarDays },
  { id: 'tareas' as const, label: 'Tareas', icon: ListChecks },
  { id: 'enfoque' as const, label: 'Enfoque', icon: Timer },
]

export function Nav({ view, onNavigate, onNew }: Props) {
  const go = (next: View) => {
    if (next === view) return
    haptic('selection')
    onNavigate(next)
  }

  const create = () => {
    haptic('medium')
    onNew()
  }

  return (
    <>
      <nav className="rail" aria-label="Navegación principal">
        <div className="rail__brand">
          <Logo size={30} />
          <span className="rail__word">messoff</span>
        </div>

        <div className="rail__nav">
          {ITEMS.map(({ id, label, icon: Icon }) => {
            const active = view === id
            return (
              <button
                key={id}
                type="button"
                className={`rail__item ${active ? 'is-active' : ''}`}
                onClick={() => go(id)}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
              >
                {active && (
                  <m.span
                    layoutId="rail-indicator"
                    className="rail__indicator"
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  />
                )}
                <span className="rail__icon">
                  <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className="rail__label" aria-hidden="true">
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="rail__foot">
          <m.button
            type="button"
            className="rail__new"
            onClick={create}
            aria-label="Crear evento"
            whileTap={{ scale: 0.9, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 600, damping: 22 }}
          >
            <Plus size={20} strokeWidth={2} aria-hidden="true" />
          </m.button>
          <span className="rail__hint">N</span>
        </div>
      </nav>

      <nav className="tabbar" aria-label="Navegación principal">
        <div className="tabbar__pill">
          {ITEMS.slice(0, 2).map(({ id, label, icon: Icon }) => (
            <TabButton
              key={id}
              label={label}
              active={view === id}
              onClick={() => go(id)}
              icon={<Icon size={20} strokeWidth={1.8} aria-hidden="true" />}
            />
          ))}
          <m.button
            type="button"
            className="tabbar__add"
            onClick={create}
            aria-label="Crear evento"
            whileTap={{ scale: 0.88, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 600, damping: 22 }}
          >
            <Plus size={22} strokeWidth={2} aria-hidden="true" />
          </m.button>
          {ITEMS.slice(2).map(({ id, label, icon: Icon }) => (
            <TabButton
              key={id}
              label={label}
              active={view === id}
              onClick={() => go(id)}
              icon={<Icon size={20} strokeWidth={1.8} aria-hidden="true" />}
            />
          ))}
        </div>
      </nav>
    </>
  )
}

function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <m.button
      type="button"
      className={`tab ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      whileTap={{ scale: 0.92 }}
    >
      {active && (
        <m.span
          layoutId="tab-indicator"
          className="tab__indicator"
          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
        />
      )}
      <m.span
        className="tab__icon"
        animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      >
        {icon}
      </m.span>
      <span className="tab__label">{label}</span>
    </m.button>
  )
}
