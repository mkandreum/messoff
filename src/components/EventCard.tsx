import { m } from 'motion/react'
import { MapPin } from 'lucide-react'
import type { CalEvent } from '../types'
import { fmtTime } from '../lib/date'
import { heightPct, topPct } from '../lib/grid'
import { usePlanner } from '../state'
import { teamById, teamHex } from '../lib/teams'
import { AvatarStack } from './ui'

type Props = {
  event: CalEvent
  index?: number
  onOpen: (id: string) => void
  onPressStart: (e: React.PointerEvent<HTMLElement>, event: CalEvent) => void
  suppressClick: () => boolean
  origin?: boolean
  stacked?: boolean
}

export function EventCard({
  event,
  index = 0,
  onOpen,
  onPressStart,
  suppressClick,
  origin,
  stacked,
}: Props) {
  const { teams, theme } = usePlanner()
  const team = teamById(teams, event.teamId)
  const compact = event.duration <= 30
  const tight = event.duration <= 45
  const showMeta = event.duration >= 90
  const tall = event.duration >= 120
  const showNote = tall && !!event.note
  const durLabel =
    event.duration >= 60
      ? `${Math.floor(event.duration / 60)} h${event.duration % 60 ? ` ${event.duration % 60}` : ''}`
      : `${event.duration} min`
  return (
    <m.button
      type="button"
      layoutId={`ev-${event.id}`}
      layout
      draggable={false}
      data-event-card={event.id}
      className={`event event--${event.category} ${compact ? 'event--compact' : ''} ${
        tight ? 'event--tight' : ''
      } ${!showMeta ? 'event--dense' : ''} ${showNote ? 'event--hasnote' : ''} ${
        origin ? 'is-origin' : ''
      } ${stacked ? 'event--stacked' : ''}`}
      style={{ top: `${topPct(event.start)}%`, height: `calc(${heightPct(event.duration, event.start)}% - 5px)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        layout: { type: 'spring', stiffness: 420, damping: 38 },
        opacity: { duration: 0.24, delay: Math.min(index * 0.018, 0.18) },
      }}
      onPointerDown={(e) => onPressStart(e, event)}
      onClick={() => {
        if (suppressClick()) return
        onOpen(event.id)
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      title={`${event.title} · mantén pulsado para mover`}
    >
      <span className="event__rail" aria-hidden="true" />
      {team && (
        <span
          className="event__team"
          style={{ ['--c' as string]: teamHex(team.color, theme === 'night') }}
          title={`Equipo: ${team.name}`}
          aria-hidden="true"
        />
      )}
      <span className="event__grip" data-drag-handle aria-hidden="true" title="Arrastrar" />
      <span className="event__dots" data-drag-handle aria-hidden="true" title="Arrastrar">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      {compact ? (
        <span className="event__row">
          <span className="event__time">{fmtTime(event.start)}</span>
          <span className="event__title">{event.title}</span>
        </span>
      ) : (
        <>
          <span className="event__top">
            <span className="event__time">{fmtTime(event.start)}</span>
            <span className="event__dur">{durLabel}</span>
            {event.checklist?.length ? (
              <span className="event__check">
                {event.checklist.filter((c) => c.done).length}/{event.checklist.length}
              </span>
            ) : null}
          </span>
          <span className="event__title">{event.title}</span>
          {event.location && showMeta ? (
            <span className="event__place">
              <MapPin size={10} strokeWidth={1.8} aria-hidden="true" />
              {event.location}
            </span>
          ) : null}
          {showNote ? <span className="event__note">{event.note}</span> : null}
          {showMeta && (event.attendees?.length ?? 0) > 0 ? (
            <AvatarStack names={event.attendees ?? []} max={3} />
          ) : null}
        </>
      )}
      <span className="sr-only">
        {team ? `. Equipo ${team.name}` : ''}. Mantén pulsado para mover.
      </span>
    </m.button>
  )
}
