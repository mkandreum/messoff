import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
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
import { AppHeader } from './components/AppHeader'
import { Nav } from './components/Nav'
import { WeekGrid } from './components/WeekGrid'
import { MonthView } from './components/MonthView'
import { TodayView } from './components/Today'
import { TasksView } from './components/Tasks'
import { FocusView } from './components/Focus'
import { EventSheet } from './components/EventSheet'
import { CommandPalette } from './components/CommandPalette'
import { QuickAdd } from './components/QuickAdd'
import { SettingsMenu } from './components/SettingsMenu'
import { Toast } from './components/Toast'

const CAL_VIEWS: { id: CalView; label: string }[] = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]

export function App() {
  const { events, tasks, now, user } = usePlanner()
  const [view, setView] = useState<View>('calendario')
  const [calView, setCalView] = useState<CalView>('semana')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickPreset, setQuickPreset] = useState<{ date: Date; start: number } | null>(null)

  const selectedEvent = events.find((event) => event.id === selectedId) ?? null
  const todayEvents = events.filter((event) => event.date === iso(now))
  const pending = tasks.filter((task) => !task.done)
  const pendingToday = pending.filter((task) => task.due === iso(now))
  const completedTasks = tasks.filter((task) => task.done).length
  const eventWord = todayEvents.length === 1 ? 'evento' : 'eventos'
  const pendingTodayWord = pendingToday.length === 1 ? 'pendiente' : 'pendientes'
  const pendingWord = pending.length === 1 ? 'pendiente' : 'pendientes'
  const completedWord = completedTasks === 1 ? 'completada' : 'completadas'

  const closeSheet = useCallback(() => setSelectedId(null), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const closeQuick = useCallback(() => setQuickOpen(false), [])

  const openEvent = useCallback((id: string) => {
    haptic('selection')
    setSelectedId(id)
    setPaletteOpen(false)
  }, [])

  const openQuick = useCallback((preset: { date: Date; start: number } | null) => {
    haptic('selection')
    setQuickPreset(preset)
    setQuickOpen(true)
    setSettingsOpen(false)
  }, [])

  const newEvent = useCallback(() => openQuick(null), [openQuick])

  const goToday = useCallback(() => {
    haptic('selection')
    setAnchor(new Date())
  }, [])

  const shiftRange = useCallback(
    (direction: 1 | -1) => {
      haptic('selection')
      setAnchor((prev) => {
        if (calView === 'mes') {
          return new Date(prev.getFullYear(), prev.getMonth() + direction, 1, 12)
        }
        return addDays(prev, direction * (calView === 'dia' ? 1 : 7))
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
  }, [view, paletteOpen, quickOpen, settingsOpen, selectedId, newEvent, shiftRange, goToday])

  const days =
    calView === 'dia' ? [startOfDay(anchor)] : allWeekDays(anchor)
  const monday = startOfWeek(anchor)

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
          Toca un día para abrirlo. <strong>Los puntos</strong> resumen tu carga.
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

  return (
    <div className="app">
      <Nav view={view} onNavigate={setView} onNew={newEvent} />

      <main className="main">
        <AppHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          showNextUp={view === 'hoy' || view === 'calendario'}
          onSearch={() => setPaletteOpen(true)}
          onSettings={() => setSettingsOpen((value) => !value)}
          onNew={newEvent}
          onOpenEvent={openEvent}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: [0.22, 0.8, 0.3, 1] }}
          >
            {view === 'hoy' && (
              <TodayView
                onOpen={openEvent}
                onGoWeek={() => {
                  haptic('selection')
                  setView('calendario')
                  setCalView('semana')
                }}
                onGoTasks={() => {
                  haptic('selection')
                  setView('tareas')
                }}
                onGoFocus={() => {
                  haptic('selection')
                  setView('enfoque')
                }}
              />
            )}

            {view === 'calendario' && (
              <div className="calendarview">
                <div className="calbar">
                  <div className="datepill">
                    <button
                      type="button"
                      className="datepill__btn"
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
                    </button>
                    <button
                      type="button"
                      className="datepill__label"
                      onClick={goToday}
                      title="Volver a hoy"
                    >
                      <span className="datepill__main">{dateLabel}</span>
                      <span className="datepill__sub">{dateSub}</span>
                    </button>
                    <button
                      type="button"
                      className="datepill__btn"
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
                    </button>
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
                            haptic('selection')
                            setCalView(option.id)
                          }}
                        >
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

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={calView}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    {calView === 'mes' ? (
                      <MonthView
                        anchor={anchor}
                        events={events}
                        onOpen={openEvent}
                        onPickDay={pickDay}
                      />
                    ) : (
                      <WeekGrid
                        days={days}
                        events={events}
                        onOpen={openEvent}
                        onPickDay={pickDay}
                        onSlotClick={(date, start) => openQuick({ date, start })}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {view === 'tareas' && <TasksView />}
            {view === 'enfoque' && <FocusView onOpen={openEvent} />}
          </motion.div>
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
        {selectedEvent && (
          <EventSheet event={selectedEvent} onClose={closeSheet} onSelect={setSelectedId} />
        )}
      </AnimatePresence>

      <QuickAdd
        open={quickOpen}
        onClose={closeQuick}
        preset={quickPreset}
        onCreated={openEvent}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        onNavigate={(next) => {
          setView(next)
          if (next === 'calendario') setCalView('semana')
        }}
        onNewEvent={newEvent}
        onNewTask={() => {
          setView('tareas')
          window.setTimeout(() => {
            document.getElementById('new-task-input')?.focus()
          }, 260)
        }}
        onOpenEvent={openEvent}
      />

      <SettingsMenu open={settingsOpen} onClose={closeSettings} />
      <Toast />
    </div>
  )
}
