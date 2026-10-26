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
    haptic('selection')
    onNavigate(next)
  }

  return (
    <>
      <nav className="rail" aria-label="Navegación principal">
        <div className="rail__brand">
          <Logo size={30} />
          <span className="rail__word">pulso</span>
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
          <button type="button" className="rail__new" onClick={onNew} aria-label="Crear evento">
            <Plus size={20} strokeWidth={2} aria-hidden="true" />
          </button>
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
          <button
            type="button"
            className="tabbar__add"
            onClick={onNew}
            aria-label="Crear evento"
          >
            <Plus size={22} strokeWidth={2} aria-hidden="true" />
          </button>
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
    <button
      type="button"
      className={`tab ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
    >
      <span className="tab__icon">{icon}</span>
      <span className="tab__label">{label}</span>
    </button>
  )
}
