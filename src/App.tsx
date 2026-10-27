import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { ChevronLeft, ChevronRight, Pause, Play, Plus } from 'lucide-react'
import type { CalView, View } from './types'
import {
  MONTHS,
  addDays,
  allWeekDays,
  fmtDateLong,
  fmtDateMedium,
  fmtMonth,
  iso,
  startOfDay,
  startOfWeek,
  weekNumber,
  weekRangeLabel,
} from './lib/date'
import { haptic } from './lib/haptics'
import { usePlanner } from './state'
import { fmtClock, useFocusTimer } from './focusTimer'
import { AppHeader } from './components/AppHeader'
import { Nav } from './components/Nav'
import { WeekGrid } from './components/WeekGrid'
import { TodayView } from './components/Today'
import { Toast } from './components/Toast'

// Lo que no se ve al abrir se descarga después: arranque más rápido.
const MonthView = lazy(() =>
  import('./components/MonthView').then((m) => ({ default: m.MonthView })),
)
const TasksView = lazy(() => import('./components/Tasks').then((m) => ({ default: m.TasksView })))
const FocusView = lazy(() => import('./components/Focus').then((m) => ({ default: m.FocusView })))
const EventSheet = lazy(() =>
  import('./components/EventSheet').then((m) => ({ default: m.EventSheet })),
)
const CommandPalette = lazy(() =>
  import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
const QuickAdd = lazy(() => import('./components/QuickAdd').then((m) => ({ default: m.QuickAdd })))
const SettingsMenu = lazy(() =>
  import('./components/SettingsMenu').then((m) => ({ default: m.SettingsMenu })),
)

const preloadLayers = () => {
  void import('./components/EventSheet')
  void import('./components/QuickAdd')
  void import('./components/CommandPalette')
  void import('./components/SettingsMenu')
  void import('./components/Tasks')
  void import('./components/Focus')
  void import('./components/MonthView')
}

const CAL_VIEWS: { id: CalView; label: string }[] = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]

const ViewFallback = () => <div className="view-fallback" aria-hidden="true" />

export function App() {
  const { eventsByDate, events, tasks, now, user } = usePlanner()
  const focus = useFocusTimer()
  const [view, setView] = useState<View>('calendario')
  const [calView, setCalView] = useState<CalView>('semana')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [direction, setDirection] = useState<1 | -1>(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickPreset, setQuickPreset] = useState<{ date: Date; start: number } | null>(null)
  const [layersReady, setLayersReady] = useState(false)
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)

  useEffect(() => {
    // Precarga las capas en un momento ocioso para que abran al instante.
    const idle =
      (window as Window & { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200))
    idle(() => {
      preloadLayers()
      setLayersReady(true)
    })
  }, [])

  const selectedEvent = selectedId ? events.find((event) => event.id === selectedId) ?? null : null
  const todayEvents = eventsByDate.get(iso(now)) ?? []
  const pending = tasks.filter((task) => !task.done)
  const pendingToday = pending.filter((task) => task.due === iso(now))
  const completedTasks = tasks.length - pending.length
  const eventWord = todayEvents.length === 1 ? 'evento' : 'eventos'
  const pendingTodayWord = pendingToday.length === 1 ? 'pendiente' : 'pendientes'
  const pendingWord = pending.length === 1 ? 'pendiente' : 'pendientes'
  const completedWord = completedTasks === 1 ? 'completada' : 'completadas'

  const closeSheet = useCallback(() => setSelectedId(null), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const closeQuick = useCallback(() => setQuickOpen(false), [])

  const navigate = useCallback((next: View) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [])

  const openEvent = useCallback((id: string) => {
    haptic('selection')
    setSelectedId(id)
    setPaletteOpen(false)
  }, [])

  const openQuick = useCallback((preset: { date: Date; start: number } | null) => {
    haptic('medium')
    setQuickPreset(preset)
    setQuickOpen(true)
    setSettingsOpen(false)
  }, [])

  const newEvent = useCallback(() => openQuick(null), [openQuick])

  const goToday = useCallback(() => {
    haptic('selection')
    setAnchor((prev) => {
      setDirection(prev.getTime() > Date.now() ? -1 : 1)
      return new Date()
    })
  }, [])

  const shiftRange = useCallback(
    (step: 1 | -1) => {
      haptic('selection')
      setDirection(step)
      setAnchor((prev) => {
        if (calView === 'mes') {
          return new Date(prev.getFullYear(), prev.getMonth() + step, 1, 12)
        }
        return addDays(prev, step * (calView === 'dia' ? 1 : 7))
      })
    },
    [calView],
  )

  const pickDay = useCallback((day: Date) => {
    haptic('selection')
    setAnchor(day)
    setCalView('dia')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        !!target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSettingsOpen(false)
        setPaletteOpen((value) => !value)
        return
      }
      if (typing) return
      if (paletteOpen || quickOpen || settingsOpen || selectedId) return
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        newEvent()
        return
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
        const views: View[] = ['hoy', 'calendario', 'tareas', 'enfoque']
        haptic('selection')
        navigate(views[Number(e.key) - 1])
        return
      }
      if (view === 'calendario') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          shiftRange(-1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          shiftRange(1)
        } else if (e.key.toLowerCase() === 't') {
          e.preventDefault()
          goToday()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, paletteOpen, quickOpen, settingsOpen, selectedId, newEvent, shiftRange, goToday, navigate])

  // Deslizar a izquierda/derecha cambia de día o de mes (la semana ya hace scroll lateral).
  const onSwipeStart = (e: React.TouchEvent) => {
    if (calView === 'semana' || e.touches.length !== 1) return
    const t = e.touches[0]
    swipe.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }
  const onSwipeEnd = (e: React.TouchEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 64 && Math.abs(dy) < 48 && Date.now() - start.t < 600) {
      shiftRange(dx < 0 ? 1 : -1)
    }
  }

  const days = calView === 'dia' ? [startOfDay(anchor)] : allWeekDays(anchor)
  const monday = startOfWeek(anchor)
  const rangeKey = `${calView}-${calView === 'mes' ? `${anchor.getFullYear()}-${anchor.getMonth()}` : iso(calView === 'dia' ? anchor : monday)}`

  const dateLabel =
    calView === 'mes'
      ? fmtMonth(anchor)
      : calView === 'dia'
        ? `${fmtDateMedium(anchor)}`
        : weekRangeLabel(monday)
  const dateSub =
    calView === 'mes'
      ? 'Vista mensual'
      : `Semana ${weekNumber(anchor)} · ${anchor.getFullYear()}`

  const firstName = user.name.trim().split(/\s+/)[0] || 'tú'

  const title =
    view === 'hoy' ? (
      <>
        Hola, <em>{firstName}</em>
      </>
    ) : view === 'calendario' ? (
      calView === 'dia' ? (
        <>
          Tu <em>día</em>
        </>
      ) : calView === 'mes' ? (
        <>
          Tu <em>mes</em>
        </>
      ) : (
        <>
          Tu <em>semana</em>
        </>
      )
    ) : view === 'tareas' ? (
      <>
        Tu <em>bandeja</em>
      </>
    ) : (
      <>
        Modo <em>enfoque</em>
      </>
    )

  const subtitle =
    view === 'hoy' ? (
      <>
        Hoy tienes <strong>{todayEvents.length} {eventWord}</strong> y{' '}
        <strong>{pendingToday.length} {pendingTodayWord}</strong>. El resto puede esperar.
      </>
    ) : view === 'calendario' ? (
      calView === 'mes' ? (
        <>
          Toca un día para abrirlo. <strong>Desliza</strong> para cambiar de mes.
        </>
      ) : calView === 'dia' ? (
        <>
          Todo lo de hoy, con espacio. <strong>Toca un hueco</strong> para crear.
        </>
      ) : (
        <>
          <span className="hint-desktop">
            Arrastra un evento para moverlo. <strong>Toca un hueco</strong> para crear.
          </span>
          <span className="hint-mobile">
            Mantén pulsado para mover. <strong>Toca un hueco</strong> para crear.
          </span>
        </>
      )
    ) : view === 'tareas' ? (
      <>
        <strong>{pending.length} {pendingWord}</strong> · elige la siguiente cosa pequeña.
      </>
    ) : (
      <>
        Una cosa a la vez. <strong>El resto puede esperar.</strong>
      </>
    )

  const eyebrow =
    view === 'hoy'
      ? fmtDateLong(now)
      : view === 'calendario'
        ? calView === 'mes'
          ? fmtMonth(anchor)
          : calView === 'dia'
            ? fmtDateLong(anchor)
            : `Semana ${weekNumber(anchor)} · ${MONTHS[anchor.getMonth()]}`
        : view === 'tareas'
          ? `${completedTasks} ${completedWord}`
          : fmtDateLong(now)

  const focusRemainingPct = Math.round((1 - focus.remaining / (focus.preset * 60)) * 100)
  const showFocusPill =
    view !== 'enfoque' && (focus.running || (focus.remaining > 0 && focus.remaining < focus.preset * 60))

  return (
    <div className="app">
      <Nav view={view} onNavigate={navigate} onNew={newEvent} />

      <main className="main">
        <AppHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          showNextUp={view === 'hoy' || view === 'calendario'}
          onSearch={() => {
            haptic('selection')
            setPaletteOpen(true)
          }}
          onSettings={() => {
            haptic('selection')
            setSettingsOpen((value) => !value)
          }}
          onNew={newEvent}
          onOpenEvent={openEvent}
        />

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={view}
            className="view"
            initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
            transition={{ duration: 0.22, ease: [0.22, 0.8, 0.3, 1] }}
          >
            <Suspense fallback={<ViewFallback />}>
              {view === 'hoy' && (
                <TodayView
                  onOpen={openEvent}
                  onGoWeek={() => {
                    haptic('selection')
                    navigate('calendario')
                    setCalView('semana')
                  }}
                  onGoTasks={() => {
                    haptic('selection')
                    navigate('tareas')
                  }}
                  onGoFocus={() => {
                    haptic('selection')
                    navigate('enfoque')
                  }}
                />
              )}

              {view === 'calendario' && (
                <div className="calendarview">
                  <div className="calbar">
                    <div className="datepill">
                      <m.button
                        type="button"
                        className="datepill__btn"
                        whileTap={{ scale: 0.86 }}
                        onClick={() => shiftRange(-1)}
                        aria-label={
                          calView === 'mes'
                            ? 'Mes anterior'
                            : calView === 'dia'
                              ? 'Día anterior'
                              : 'Semana anterior'
                        }
                      >
                        <ChevronLeft size={17} strokeWidth={1.9} aria-hidden="true" />
                      </m.button>
                      <button
                        type="button"
                        className="datepill__label"
                        onClick={goToday}
                        title="Volver a hoy"
                      >
                        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                          <m.span
                            key={dateLabel}
                            className="datepill__main"
                            custom={direction}
                            initial={{ opacity: 0, x: direction * 14 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction * -14 }}
                            transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                          >
                            {dateLabel}
                          </m.span>
                        </AnimatePresence>
                        <span className="datepill__sub">{dateSub}</span>
                      </button>
                      <m.button
                        type="button"
                        className="datepill__btn"
                        whileTap={{ scale: 0.86 }}
                        onClick={() => shiftRange(1)}
                        aria-label={
                          calView === 'mes'
                            ? 'Mes siguiente'
                            : calView === 'dia'
                              ? 'Día siguiente'
                              : 'Semana siguiente'
                        }
                      >
                        <ChevronRight size={17} strokeWidth={1.9} aria-hidden="true" />
                      </m.button>
                    </div>

                    <div className="seg" role="tablist" aria-label="Vista del calendario">
                      {CAL_VIEWS.map((option) => {
                        const active = calView === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`seg__btn ${active ? 'is-active' : ''}`}
                            onClick={() => {
                              if (active) return
                              haptic('selection')
                              setCalView(option.id)
                            }}
                          >
                            {active && (
                              <m.span
                                layoutId="seg-indicator"
                                className="seg__indicator"
                                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                              />
                            )}
                            <span>{option.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="calbar__right">
                      <button type="button" className="btn btn--ghost calbar__today" onClick={goToday}>
                        Hoy
                      </button>
                      <button type="button" className="btn btn--primary" onClick={newEvent}>
                        <Plus size={15} strokeWidth={2} aria-hidden="true" />
                        <span>Evento</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className="calendarview__stage"
                    onTouchStart={onSwipeStart}
                    onTouchEnd={onSwipeEnd}
                  >
                    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                      <m.div
                        key={rangeKey}
                        custom={direction}
                        initial={{ opacity: 0, x: direction * 28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -28 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }}
                      >
                        {calView === 'mes' ? (
                          <MonthView anchor={anchor} onOpen={openEvent} onPickDay={pickDay} />
                        ) : (
                          <WeekGrid
                            days={days}
                            onOpen={openEvent}
                            onPickDay={pickDay}
                            onSlotClick={(date, start) => openQuick({ date, start })}
                          />
                        )}
                      </m.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {view === 'tareas' && <TasksView />}
              {view === 'enfoque' && <FocusView onOpen={openEvent} />}
            </Suspense>
          </m.div>
        </AnimatePresence>

        <footer className="appfoot">
          <span>Pulso</span>
          <span className="appfoot__dot" aria-hidden="true">✳</span>
          <span>Tu semana, con pulso.</span>
          <span className="appfoot__spacer" />
          <span>{fmtDateLong(now)}</span>
        </footer>
      </main>

      <AnimatePresence>
        {showFocusPill && (
          <m.div
            className={`focuspill ${focus.running ? 'is-running' : ''}`}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          >
            <button
              type="button"
              className="focuspill__main"
              onClick={() => {
                haptic('selection')
                navigate('enfoque')
              }}
              aria-label="Abrir enfoque"
            >
              <span
                className="focuspill__ring"
                style={{ ['--p' as string]: `${focusRemainingPct}%` }}
                aria-hidden="true"
              />
              <span className="focuspill__time">{fmtClock(focus.remaining)}</span>
            </button>
            <button
              type="button"
              className="focuspill__toggle"
              onClick={focus.toggle}
              aria-label={focus.running ? 'Pausar enfoque' : 'Reanudar enfoque'}
            >
              {focus.running ? (
                <Pause size={14} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <Play size={14} strokeWidth={2.2} aria-hidden="true" />
              )}
            </button>
          </m.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <AnimatePresence>
          {selectedEvent && (
            <EventSheet event={selectedEvent} onClose={closeSheet} onSelect={setSelectedId} />
          )}
        </AnimatePresence>

        {(layersReady || quickOpen) && (
          <QuickAdd
            open={quickOpen}
            onClose={closeQuick}
            preset={quickPreset}
            onCreated={openEvent}
          />
        )}

        {(layersReady || paletteOpen) && (
          <CommandPalette
            open={paletteOpen}
            onClose={closePalette}
            onNavigate={(next) => {
              navigate(next)
              if (next === 'calendario') setCalView('semana')
            }}
            onNewEvent={newEvent}
            onNewTask={() => {
              navigate('tareas')
              window.setTimeout(() => {
                document.getElementById('new-task-input')?.focus()
              }, 260)
            }}
            onOpenEvent={openEvent}
          />
        )}

        {(layersReady || settingsOpen) && (
          <SettingsMenu open={settingsOpen} onClose={closeSettings} />
        )}
      </Suspense>
      <Toast />
    </div>
  )
}
