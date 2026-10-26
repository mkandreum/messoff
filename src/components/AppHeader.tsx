import type { ReactNode } from 'react'
import { ArrowUpRight, Plus, Search } from 'lucide-react'
import { usePlanner } from '../state'
import {
  fmtDateMedium,
  fmtRange,
  iso,
  parseISO,
  relativeCountdown,
} from '../lib/date'
import { initials, Kbd } from './ui'

type HeaderProps = {
  eyebrow: string
  title: ReactNode
  subtitle: ReactNode
  showNextUp?: boolean
  onSearch: () => void
  onSettings: () => void
  onNew: () => void
  onOpenEvent: (id: string) => void
}

export function NextUp({ onOpen }: { onOpen: (id: string) => void }) {
  const { events, now } = usePlanner()
  const upcoming = events
    .map((event) => {
      const date = parseISO(event.date)
      date.setHours(Math.floor(event.start / 60), event.start % 60, 0, 0)
      return { event, at: date.getTime() }
    })
    .filter(({ at }) => at >= now.getTime() - 60_000)
    .sort((a, b) => a.at - b.at)[0]

  if (!upcoming) {
    return (
      <aside className="nextup nextup--empty" aria-label="Próximo evento">
        <span className="nextup__tape" aria-hidden="true" />
        <span className="nextup__label">SIN PRISA</span>
        <p className="nextup__empty-copy">Tu semana está despejada.</p>
        <span className="nextup__empty-tag">Añade algo que apetezca</span>
      </aside>
    )
  }

  const { event } = upcoming
  return (
    <aside className="nextup" aria-label="Próximo evento">
      <span className="nextup__tape" aria-hidden="true" />
      <div className="nextup__top">
        <span className="nextup__label">PRÓXIMO</span>
        <span className="nextup__count">{relativeCountdown(event.date, event.start, now)}</span>
      </div>
      <button
        type="button"
        className="nextup__body"
        onClick={() => onOpen(event.id)}
      >
        <span className="nextup__date">
          {fmtDateMedium(parseISO(event.date))} · {fmtRange(event.start, event.duration)}
        </span>
        <span className="nextup__title">{event.title}</span>
        {event.location && <span className="nextup__place">{event.location}</span>}
        <span className="nextup__go" aria-hidden="true">
          <ArrowUpRight size={15} strokeWidth={1.8} />
        </span>
      </button>
      <span className="nextup__today" aria-hidden="true">
        {iso(now) === event.date ? 'HOY' : 'MÁS ADELANTE'}
      </span>
    </aside>
  )
}

export function AppHeader({
  eyebrow,
  title,
  subtitle,
  showNextUp,
  onSearch,
  onSettings,
  onNew,
  onOpenEvent,
}: HeaderProps) {
  const { events, user } = usePlanner()

  return (
    <header className="topbar">
      <div className="topbar__intro">
        <p className="eyebrow">
          <span className="eyebrow__dot" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{subtitle}</p>
      </div>

      <div className="topbar__side">
        <div className="topbar__actions">
          <button type="button" className="searchbtn" onClick={onSearch} aria-label="Buscar ⌘ K">
            <Search size={16} strokeWidth={1.8} aria-hidden="true" />
            <span className="searchbtn__label">Buscar</span>
            <span className="searchbtn__kbd" aria-hidden="true">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <button
            type="button"
            className="accountbtn"
            onClick={onSettings}
            aria-label={`Cuenta de ${user.name}`}
            title="Cuenta y ajustes"
          >
            <span className="accountbtn__avatar">{initials(user.name)}</span>
          </button>
          <button type="button" className="btn btn--primary header-new" onClick={onNew}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            <span>Nuevo</span>
          </button>
        </div>
        {showNextUp && events.length > 0 && <NextUp onOpen={onOpenEvent} />}
      </div>
    </header>
  )
}
