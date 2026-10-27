import { m } from 'motion/react'
import { ArrowUpRight, Pause, Play, RotateCcw, Sparkles, Volume2 } from 'lucide-react'
import {
  fmtDateMedium,
  fmtDuration,
  fmtTime,
  parseISO,
  relativeCountdown,
} from '../lib/date'
import { fmtClock, useFocusTimer } from '../focusTimer'
import { usePlanner } from '../state'
import { Switch } from './ui'

const PRESETS = [25, 50, 90]

export function FocusView({ onOpen }: { onOpen: (id: string) => void }) {
  const { events, now, hapticsEnabled, setHaptics } = usePlanner()
  const { preset, remaining, running, sessions, choose, toggle, reset } = useFocusTimer()

  const total = preset * 60
  const progress = Math.min(1, Math.max(0, 1 - remaining / total))
  const circumference = 2 * Math.PI * 148
  const clock = fmtClock(remaining)

  const upcoming = events
    .map((event) => {
      const date = parseISO(event.date)
      date.setHours(Math.floor(event.start / 60), event.start % 60, 0, 0)
      return { event, at: date.getTime() }
    })
    .filter(({ at }) => at >= now.getTime())
    .sort((a, b) => a.at - b.at)[0]

  const totalToday = sessions.reduce((sum, s) => sum + s.minutes, 0)

  return (
    <div className="focus">
      <div className="focus__grid">
        <section className={`focus__stage ${running ? 'is-running' : ''}`} aria-label="Temporizador de enfoque">
          <div className="focus__stagehead">
            <span className="kicker">SESIÓN DE ENFOQUE</span>
            <span className={`live ${running ? 'is-on' : ''}`}>
              <i aria-hidden="true" />
              {running ? 'En curso' : 'En pausa'}
            </span>
          </div>

          <div className="ring">
            <svg viewBox="0 0 320 320" role="img" aria-label={`${Math.round(progress * 100)}% completado`}>
              <circle className="ring__track" cx="160" cy="160" r="148" />
              <circle
                className="ring__value"
                cx="160"
                cy="160"
                r="148"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: circumference * (1 - progress),
                  transition: running ? 'stroke-dashoffset 1s linear' : 'stroke-dashoffset .35s ease',
                }}
              />
              {[0, 1, 2, 3].map((i) => (
                <line
                  key={i}
                  className="ring__tick"
                  x1="160"
                  y1="6"
                  x2="160"
                  y2="16"
                  transform={`rotate(${i * 90} 160 160)`}
                />
              ))}
            </svg>
            <div className="ring__center">
              <span className="ring__label">{running ? 'CONCENTRADO' : 'LISTO'}</span>
              <span className="ring__time">{clock}</span>
              <span className="ring__sub">{preset} minutos · sin interrupciones</span>
            </div>
            {running && <span className="ring__pulse" aria-hidden="true" />}
          </div>

          <div className="focus__presets" role="group" aria-label="Duración de la sesión">
            {PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={`preset ${preset === minutes ? 'is-active' : ''}`}
                onClick={() => choose(minutes)}
                aria-pressed={preset === minutes}
              >
                {minutes} min
              </button>
            ))}
          </div>

          <div className="focus__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={toggle}>
              {running ? (
                <Pause size={17} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Play size={17} strokeWidth={2} aria-hidden="true" />
              )}
              {running ? 'Pausar' : remaining === 0 ? 'Otra vez' : 'Empezar'}
            </button>
            <button type="button" className="btn btn--ghost btn--lg" onClick={reset}>
              <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
              Reiniciar
            </button>
          </div>

          <p className="focus__hint">
            <Volume2 size={13} strokeWidth={1.8} aria-hidden="true" />
            Al terminar, el móvil vibra con un patrón suave de logro.
          </p>
        </section>

        <aside className="focus__side">
          <section className="panel panel--tight">
            <header className="panel__head">
              <h2 className="panel__title">Después de esto</h2>
              <span className="panel__aside">Siguiente</span>
            </header>
            {upcoming ? (
              <button
                type="button"
                className={`focus__event focus__event--${upcoming.event.category}`}
                onClick={() => onOpen(upcoming.event.id)}
              >
                <span className="focus__eventdate">
                  {fmtDateMedium(parseISO(upcoming.event.date))} ·{' '}
                  {fmtTime(upcoming.event.start)}
                </span>
                <span className="focus__eventtitle">{upcoming.event.title}</span>
                <span className="focus__eventmeta">
                  {relativeCountdown(upcoming.event.date, upcoming.event.start, now)}
                  {upcoming.event.location ? ` · ${upcoming.event.location}` : ''}
                  <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
                </span>
              </button>
            ) : (
              <p className="focus__empty">Sin eventos próximos. Tiempo regalado.</p>
            )}
          </section>

          <section className="panel panel--tight">
            <header className="panel__head">
              <h2 className="panel__title">Ritual de arranque</h2>
            </header>
            <ol className="ritual">
              <li>
                <span>01</span>
                <div>
                  <strong>Una sola cosa</strong>
                  <p>Escribe el resultado en una línea. Si no cabe, no es una sesión.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Silencia lo que no importa</strong>
                  <p>Notificaciones fuera. La bandeja espera.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Veinte minutos honestos</strong>
                  <p>Empieza aunque no estés inspirado. La inspiración llega tarde.</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="panel panel--tight">
            <header className="panel__head">
              <h2 className="panel__title">Hoy</h2>
              <span className="panel__aside">{fmtDuration(totalToday)}</span>
            </header>
            <ul className="sessions">
              {sessions.length === 0 && (
                <li className="sessions__empty">Aún sin sesiones. La primera es la que cuesta.</li>
              )}
              {sessions.map((session) => (
                <m.li
                  key={session.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="dot dot--salud" aria-hidden="true" />
                  <span>
                    {session.minutes} min de enfoque
                  </span>
                  <em>
                    {new Date(session.completedAt).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </em>
                </m.li>
              ))}
            </ul>
            {sessions.length > 0 && (
              <p className="sessions__total">
                <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" />
                {sessions.length} {sessions.length === 1 ? 'sesión' : 'sesiones'} ·{' '}
                {fmtDuration(totalToday)} de atención real
              </p>
            )}
          </section>

          <section className="panel panel--tight haptics-row">
            <div>
              <h2 className="panel__title">Vibración</h2>
              <p className="haptics-row__copy">Respuesta táctil en cada gesto.</p>
            </div>
            <Switch
              checked={hapticsEnabled}
              onChange={setHaptics}
              label="Activar vibración"
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
