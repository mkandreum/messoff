import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from './lib/api'
import { iso } from './lib/date'
import { haptic } from './lib/haptics'
import { usePlanner } from './state'
import type { FocusSession } from './types'

type Stored = {
  preset: number
  /** Marca de tiempo (ms) en la que termina la sesión en curso. */
  endsAt: number | null
  /** Segundos restantes cuando está en pausa. */
  paused: number
}

type FocusValue = {
  preset: number
  remaining: number
  running: boolean
  sessions: FocusSession[]
  choose: (minutes: number) => void
  toggle: () => void
  reset: () => void
}

const KEY = 'pulso.focus'
const FocusContext = createContext<FocusValue | null>(null)

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const value = JSON.parse(raw) as Stored
      if (typeof value.preset === 'number' && typeof value.paused === 'number') return value
    }
  } catch {
    /* almacenamiento no disponible */
  }
  return { preset: 25, endsAt: null, paused: 25 * 60 }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const fmtClock = (seconds: number) =>
  `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`

/**
 * El temporizador vive por encima de las vistas: sigue contando si cambias
 * de pestaña, cierras la vista o recargas la página.
 */
export function FocusProvider({ children }: { children: ReactNode }) {
  const { notify } = usePlanner()
  const [state, setState] = useState<Stored>(read)
  const [clock, setClock] = useState(() => Date.now())
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const completing = useRef(false)

  const running = state.endsAt !== null
  const remaining = running
    ? Math.max(0, Math.ceil(((state.endsAt ?? 0) - clock) / 1000))
    : state.paused

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* almacenamiento no disponible */
    }
  }, [state])

  useEffect(() => {
    let alive = true
    api<{ sessions: FocusSession[] }>(`/focus-sessions?date=${iso(new Date())}`)
      .then((data) => {
        if (alive) setSessions(data.sessions)
      })
      .catch(() => {
        /* el foco se puede usar igualmente */
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setClock(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!running) {
      document.title = 'Pulso'
      return
    }
    document.title = `${fmtClock(remaining)} · Enfoque · Pulso`
  }, [remaining, running])

  useEffect(() => {
    if (!running || remaining > 0 || completing.current) return
    completing.current = true
    const minutes = state.preset
    setState((prev) => ({ ...prev, endsAt: null, paused: 0 }))
    haptic('celebrate')
    notify(`Sesión de ${minutes} min completada. Eso es constancia.`)
    try {
      if (document.visibilityState !== 'visible' && Notification.permission === 'granted') {
        new Notification('Pulso · enfoque completado', {
          body: `${minutes} minutos de atención real.`,
          tag: 'pulso-focus',
        })
      }
    } catch {
      /* sin notificaciones del sistema */
    }
    void api<{ session: FocusSession }>('/focus-sessions', {
      method: 'POST',
      body: { minutes },
    })
      .then(({ session }) => setSessions((list) => [session, ...list]))
      .catch(() => notify('La sesión terminó, pero no se pudo guardar en el servidor.'))
      .finally(() => {
        completing.current = false
      })
  }, [notify, remaining, running, state.preset])

  const choose = useCallback((minutes: number) => {
    haptic('selection')
    setState({ preset: minutes, endsAt: null, paused: minutes * 60 })
  }, [])

  const toggle = useCallback(() => {
    setState((prev) => {
      if (prev.endsAt !== null) {
        haptic('light')
        const left = Math.max(0, Math.ceil((prev.endsAt - Date.now()) / 1000))
        return { ...prev, endsAt: null, paused: left }
      }
      haptic('heartbeat')
      const seconds = prev.paused > 0 ? prev.paused : prev.preset * 60
      return { ...prev, endsAt: Date.now() + seconds * 1000, paused: seconds }
    })
    setClock(Date.now())
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission()
      }
    } catch {
      /* sin notificaciones del sistema */
    }
  }, [])

  const reset = useCallback(() => {
    haptic('light')
    setState((prev) => ({ ...prev, endsAt: null, paused: prev.preset * 60 }))
  }, [])

  const value = useMemo(
    () => ({ preset: state.preset, remaining, running, sessions, choose, toggle, reset }),
    [choose, remaining, reset, running, sessions, state.preset, toggle],
  )

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
}

export function useFocusTimer() {
  const context = useContext(FocusContext)
  if (!context) throw new Error('useFocusTimer debe usarse dentro de FocusProvider')
  return context
}
