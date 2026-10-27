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
import { toast } from 'sonner'
import type {
  CalEvent,
  Category,
  ChecklistItem,
  Invitation,
  Task,
  Team,
  TeamColor,
  Theme,
  User,
} from './types'
import { api, ApiError } from './lib/api'
import { useAuth } from './auth'
import { haptic, setHapticsEnabled as applyHaptics } from './lib/haptics'
import { LoadError, Splash } from './components/Loading'

type TaskPatch = Partial<Pick<Task, 'title' | 'due' | 'tag' | 'done'>>

type TeamsPayload = { teams: Team[]; invitations: Invitation[] }
type BootstrapPayload = TeamsPayload & { user: User; events: CalEvent[]; tasks: Task[] }

type PlannerValue = {
  user: User
  events: CalEvent[]
  /** Eventos agrupados por fecha (YYYY-MM-DD) y ordenados por hora. */
  eventsByDate: Map<string, CalEvent[]>
  tasks: Task[]
  teams: Team[]
  invitations: Invitation[]
  /** Calendarios ocultos: 'me' o el id de un equipo. */
  hiddenCalendars: string[]
  toggleCalendar: (id: string) => void
  theme: Theme
  hapticsEnabled: boolean
  now: Date
  notify: (message: string, actionLabel?: string, onAction?: () => void) => void
  setTheme: (theme: Theme) => void
  setHaptics: (on: boolean) => void
  addEvent: (event: Omit<CalEvent, 'id'>) => CalEvent
  saveEvent: (event: CalEvent) => void
  moveEvent: (id: string, date: string, start: number) => CalEvent | undefined
  duplicateEvent: (id: string) => Promise<CalEvent | undefined>
  deleteEvent: (id: string) => CalEvent | undefined
  restoreEvent: (event: CalEvent) => void
  toggleChecklist: (eventId: string, itemId: string) => void
  addChecklistItem: (eventId: string, text: string) => void
  addTask: (title: string, due: string | null, tag: Category) => Task
  toggleTask: (id: string) => void
  updateTask: (id: string, patch: TaskPatch) => void
  deleteTask: (id: string) => Task | undefined
  restoreTask: (task: Task) => void
  scheduleTask: (id: string) => Promise<CalEvent | undefined>
  unscheduleTask: (eventId: string, taskId: string) => void
  refresh: () => Promise<void>
  createTeam: (name: string, color: TeamColor) => Promise<string | undefined>
  updateTeam: (id: string, patch: { name?: string; color?: TeamColor }) => Promise<void>
  deleteTeam: (id: string) => Promise<void>
  regenerateCode: (id: string) => Promise<void>
  inviteToTeam: (id: string, email: string) => Promise<{ registered: boolean } | undefined>
  removeInvite: (teamId: string, inviteId: string) => Promise<void>
  acceptInvitation: (id: string) => Promise<void>
  declineInvitation: (id: string) => Promise<void>
  joinTeam: (code: string) => Promise<{ id: string; name: string } | undefined>
  leaveTeam: (teamId: string, userId: string) => Promise<void>
}

const PlannerContext = createContext<PlannerValue | null>(null)

const uid = () => crypto.randomUUID()

/** Un evento nunca puede cruzar la medianoche: el servidor lo rechazaría. */
export function clampEvent<T extends Pick<CalEvent, 'start' | 'duration'>>(event: T): T {
  const start = Math.min(1439 - 5, Math.max(0, Math.round(event.start)))
  const duration = Math.max(5, Math.min(Math.round(event.duration), 1440 - start))
  return start === event.start && duration === event.duration
    ? event
    : { ...event, start, duration }
}

const REFRESH_EVERY = 20_000

export function PlannerProvider({ user, children }: { user: User; children: ReactNode }) {
  const { setUser, logout } = useAuth()
  const [events, setEvents] = useState<CalEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [hiddenCalendars, setHiddenCalendars] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('messoff.hiddenCalendars') ?? '[]')
      return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const saveTimers = useRef<Map<string, number>>(new Map())
  const inflight = useRef(0)
  const lastSync = useRef(0)
  const eventsRef = useRef(events)
  const tasksRef = useRef(tasks)
  eventsRef.current = events
  tasksRef.current = tasks

  const theme = (user.theme === 'night' ? 'night' : 'paper') as Theme
  const hapticsEnabled = user.haptics

  useEffect(() => {
    // Alinea el reloj con el minuto para que "ahora" no vaya hasta 30 s tarde.
    let interval: number | undefined
    const timeout = window.setTimeout(
      () => {
        setNow(new Date())
        interval = window.setInterval(() => setNow(new Date()), 60_000)
      },
      60_000 - (Date.now() % 60_000),
    )
    return () => {
      window.clearTimeout(timeout)
      if (interval) window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('pulso.theme', theme)
    } catch {
      /* almacenamiento no disponible */
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'night' ? '#14130f' : '#f0ebe0')
  }, [theme])

  useEffect(() => {
    applyHaptics(user.haptics)
  }, [user.haptics])

  useEffect(
    () => () => {
      for (const timer of saveTimers.current.values()) window.clearTimeout(timer)
    },
    [],
  )

  const notify = useCallback(
    (message: string, actionLabel?: string, onAction?: () => void) => {
      toast(message, {
        duration: actionLabel ? 6000 : 4200,
        action:
          actionLabel && onAction
            ? {
                label: actionLabel,
                onClick: () => {
                  haptic('light')
                  onAction()
                },
              }
            : undefined,
      })
    },
    [],
  )

  const fail = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiError && error.status === 401) {
        void logout()
        return
      }
      haptic('warning')
      notify(error instanceof ApiError ? error.message : fallback)
    },
    [logout, notify],
  )

  /** Envuelve cada escritura para no sincronizar encima de cambios en vuelo. */
  const track = useCallback(<T,>(promise: Promise<T>) => {
    inflight.current += 1
    return promise.finally(() => {
      inflight.current -= 1
      lastSync.current = Date.now()
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api<BootstrapPayload>('/bootstrap')
      setEvents(data.events)
      setTasks(data.tasks)
      setTeams(data.teams ?? [])
      setInvitations(data.invitations ?? [])
      setUser(data.user)
      lastSync.current = Date.now()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await logout()
        return
      }
      setLoadError(
        error instanceof ApiError ? error.message : 'No se pudo cargar tu agenda.',
      )
    } finally {
      setLoading(false)
    }
  }, [logout, setUser])

  /** Sincronización silenciosa: trae lo que hayas cambiado en otro dispositivo. */
  const refresh = useCallback(async () => {
    if (inflight.current > 0 || saveTimers.current.size > 0) return
    try {
      const data = await api<BootstrapPayload>('/bootstrap')
      if (inflight.current > 0 || saveTimers.current.size > 0) return
      setEvents(data.events)
      setTasks(data.tasks)
      setTeams(data.teams ?? [])
      setInvitations(data.invitations ?? [])
      lastSync.current = Date.now()
    } catch {
      /* sin conexión: seguimos con lo que hay */
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      setNow(new Date())
      if (Date.now() - lastSync.current > REFRESH_EVERY) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [refresh])

  // Con equipos, los cambios de otras personas llegan solos cada medio minuto.
  const hasTeams = teams.length > 0
  useEffect(() => {
    if (!hasTeams) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [hasTeams, refresh])

  const toggleCalendar = useCallback((id: string) => {
    setHiddenCalendars((list) => {
      const next = list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
      try {
        localStorage.setItem('messoff.hiddenCalendars', JSON.stringify(next))
      } catch {
        /* almacenamiento no disponible */
      }
      return next
    })
  }, [])

  const patchUser = useCallback(
    async (patch: Partial<Pick<User, 'theme' | 'haptics' | 'name'>>) => {
      const previous = user
      setUser({ ...user, ...patch })
      try {
        const data = await api<{ user: User }>('/auth/me', {
          method: 'PATCH',
          body: patch,
        })
        setUser(data.user)
      } catch (error) {
        setUser(previous)
        fail(error, 'No se pudo guardar el ajuste')
      }
    },
    [fail, setUser, user],
  )

  const setTheme = useCallback(
    (next: Theme) => {
      if (next === theme) return
      void patchUser({ theme: next })
    },
    [patchUser, theme],
  )

  const setHaptics = useCallback(
    (on: boolean) => {
      if (on === hapticsEnabled) return
      void patchUser({ haptics: on })
    },
    [hapticsEnabled, patchUser],
  )

  const addEvent = useCallback(
    (input: Omit<CalEvent, 'id'>) => {
      const event: CalEvent = clampEvent({ ...input, id: uid() })
      setEvents((list) => [...list, event])
      void track(api<{ event: CalEvent }>('/events', { method: 'POST', body: event })).catch(
        (error) => {
          setEvents((list) => list.filter((item) => item.id !== event.id))
          fail(error, 'No se pudo crear el evento')
        },
      )
      return event
    },
    [fail, track],
  )

  const saveEvent = useCallback(
    (input: CalEvent) => {
      const next = clampEvent(input)
      setEvents((list) => list.map((event) => (event.id === next.id ? next : event)))
      const timer = saveTimers.current.get(next.id)
      if (timer) window.clearTimeout(timer)
      const handle = window.setTimeout(() => {
        saveTimers.current.delete(next.id)
        // Un título vacío no se envía: se guardará cuando el usuario escriba algo.
        if (!next.title.trim()) return
        void track(
          api<{ event: CalEvent }>(`/events/${next.id}`, {
            method: 'PATCH',
            body: next,
          }),
        ).catch((error) => {
          fail(error, 'No se pudo guardar el evento')
          void loadData()
        })
      }, 350)
      saveTimers.current.set(next.id, handle)
    },
    [fail, loadData, track],
  )

  const moveEvent = useCallback(
    (id: string, date: string, start: number) => {
      const previous = eventsRef.current.find((event) => event.id === id)
      if (!previous) return undefined
      if (previous.date === date && previous.start === start) return previous

      const timer = saveTimers.current.get(id)
      if (timer) window.clearTimeout(timer)
      saveTimers.current.delete(id)

      const next = clampEvent({ ...previous, date, start })
      setEvents((list) => list.map((event) => (event.id === id ? next : event)))
      void track(
        api<{ event: CalEvent }>(`/events/${id}`, {
          method: 'PATCH',
          body: next,
        }),
      ).catch((error) => {
        setEvents((list) => list.map((event) => (event.id === id ? previous : event)))
        fail(error, 'No se pudo mover el evento')
      })
      return previous
    },
    [fail, track],
  )

  const duplicateEvent = useCallback(
    async (id: string) => {
      try {
        const data = await track(
          api<{ event: CalEvent }>(`/events/${id}/duplicate`, {
            method: 'POST',
          }),
        )
        setEvents((list) => [...list, data.event])
        return data.event
      } catch (error) {
        fail(error, 'No se pudo duplicar el evento')
        return undefined
      }
    },
    [fail, track],
  )

  const deleteEvent = useCallback(
    (id: string) => {
      const previous = eventsRef.current.find((event) => event.id === id)
      if (!previous) return undefined
      const timer = saveTimers.current.get(id)
      if (timer) window.clearTimeout(timer)
      saveTimers.current.delete(id)
      setEvents((list) => list.filter((event) => event.id !== id))
      void track(api(`/events/${id}`, { method: 'DELETE' })).catch((error) => {
        setEvents((list) => [...list, previous])
        fail(error, 'No se pudo eliminar el evento')
      })
      return previous
    },
    [fail, track],
  )

  const restoreEvent = useCallback(
    (event: CalEvent) => {
      setEvents((list) =>
        list.some((item) => item.id === event.id) ? list : [...list, event],
      )
      void track(api<{ event: CalEvent }>('/events', { method: 'POST', body: event })).catch(
        (error) => {
          setEvents((list) => list.filter((item) => item.id !== event.id))
          fail(error, 'No se pudo restaurar el evento')
        },
      )
    },
    [fail, track],
  )

  const toggleChecklist = useCallback(
    (eventId: string, itemId: string) => {
      const event = eventsRef.current.find((item) => item.id === eventId)
      if (!event) return
      saveEvent({
        ...event,
        checklist: (event.checklist ?? []).map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item,
        ),
      })
    },
    [saveEvent],
  )

  const addChecklistItem = useCallback(
    (eventId: string, text: string) => {
      const event = eventsRef.current.find((item) => item.id === eventId)
      if (!event) return
      const item: ChecklistItem = { id: uid(), text, done: false }
      saveEvent({ ...event, checklist: [...(event.checklist ?? []), item] })
    },
    [saveEvent],
  )

  const addTask = useCallback(
    (title: string, due: string | null, tag: Category) => {
      const task: Task = { id: uid(), title, due, tag, done: false }
      setTasks((list) => [task, ...list])
      void track(api<{ task: Task }>('/tasks', { method: 'POST', body: task })).catch(
        (error) => {
          setTasks((list) => list.filter((item) => item.id !== task.id))
          fail(error, 'No se pudo crear la tarea')
        },
      )
      return task
    },
    [fail, track],
  )

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => {
      const previous = tasksRef.current.find((task) => task.id === id)
      if (!previous) return
      if (patch.title !== undefined && !patch.title.trim()) return
      const next = { ...previous, ...patch }
      setTasks((list) => list.map((task) => (task.id === id ? next : task)))
      void track(api(`/tasks/${id}`, { method: 'PATCH', body: patch })).catch((error) => {
        setTasks((list) => list.map((task) => (task.id === id ? previous : task)))
        fail(error, 'No se pudo actualizar la tarea')
      })
    },
    [fail, track],
  )

  const toggleTask = useCallback(
    (id: string) => {
      const previous = tasksRef.current.find((task) => task.id === id)
      if (!previous) return
      updateTask(id, { done: !previous.done })
    },
    [updateTask],
  )

  const deleteTask = useCallback(
    (id: string) => {
      const previous = tasksRef.current.find((task) => task.id === id)
      if (!previous) return undefined
      setTasks((list) => list.filter((task) => task.id !== id))
      void track(api(`/tasks/${id}`, { method: 'DELETE' })).catch((error) => {
        setTasks((list) => [...list, previous])
        fail(error, 'No se pudo eliminar la tarea')
      })
      return previous
    },
    [fail, track],
  )

  const restoreTask = useCallback(
    (task: Task) => {
      setTasks((list) => (list.some((item) => item.id === task.id) ? list : [task, ...list]))
      void track(api('/tasks', { method: 'POST', body: task })).catch((error) => {
        setTasks((list) => list.filter((item) => item.id !== task.id))
        fail(error, 'No se pudo restaurar la tarea')
      })
    },
    [fail, track],
  )

  const scheduleTask = useCallback(
    async (id: string) => {
      try {
        const data = await track(
          api<{ event: CalEvent; task: Task }>(`/tasks/${id}/schedule`, {
            method: 'POST',
            body: {},
          }),
        )
        setEvents((list) => [...list, data.event])
        setTasks((list) => list.map((task) => (task.id === id ? data.task : task)))
        return data.event
      } catch (error) {
        fail(error, 'No se pudo programar la tarea')
        return undefined
      }
    },
    [fail, track],
  )

  /** Deshace "programar": borra el evento y devuelve la tarea a pendiente. */
  const unscheduleTask = useCallback(
    (eventId: string, taskId: string) => {
      deleteEvent(eventId)
      updateTask(taskId, { done: false })
    },
    [deleteEvent, updateTask],
  )

  const visibleEvents = useMemo(
    () =>
      hiddenCalendars.length
        ? events.filter((event) => !hiddenCalendars.includes(event.teamId ?? 'me'))
        : events,
    [events, hiddenCalendars],
  )

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const event of visibleEvents) {
      const list = map.get(event.date)
      if (list) list.push(event)
      else map.set(event.date, [event])
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start - b.start || b.duration - a.duration)
    }
    return map
  }, [visibleEvents])

  // ---------- Equipos ----------

  const teamCall = useCallback(
    async <T extends TeamsPayload>(
      path: string,
      method: 'POST' | 'PATCH' | 'DELETE',
      body?: unknown,
      failMessage = 'No se pudo completar la acción',
    ) => {
      try {
        const data = await track(api<T>(path, { method, body }))
        setTeams(data.teams)
        setInvitations(data.invitations)
        return data
      } catch (error) {
        fail(error, failMessage)
        return undefined
      }
    },
    [fail, track],
  )

  const createTeam = useCallback(
    async (name: string, color: TeamColor) => {
      const data = await teamCall<TeamsPayload & { team: { id: string } }>('/teams', 'POST', { name, color }, 'No se pudo crear el equipo')
      return data?.team.id
    },
    [teamCall],
  )

  const updateTeam = useCallback(
    async (id: string, patch: { name?: string; color?: TeamColor }) => {
      await teamCall(`/teams/${id}`, 'PATCH', patch)
    },
    [teamCall],
  )

  const deleteTeam = useCallback(
    async (id: string) => {
      const data = await teamCall(`/teams/${id}`, 'DELETE')
      if (data) await refresh()
    },
    [refresh, teamCall],
  )

  const regenerateCode = useCallback(
    async (id: string) => {
      await teamCall(`/teams/${id}/code`, 'POST', {})
    },
    [teamCall],
  )

  const inviteToTeam = useCallback(
    async (id: string, email: string) => {
      const data = await teamCall<TeamsPayload & { registered: boolean }>(`/teams/${id}/invites`, 'POST', { email }, 'No se pudo invitar')
      return data ? { registered: data.registered } : undefined
    },
    [teamCall],
  )

  const removeInvite = useCallback(
    async (teamId: string, inviteId: string) => {
      await teamCall(`/teams/${teamId}/invites/${inviteId}`, 'DELETE')
    },
    [teamCall],
  )

  const acceptInvitation = useCallback(
    async (id: string) => {
      const data = await teamCall(`/teams/invitations/${id}/accept`, 'POST', {})
      if (data) await refresh()
    },
    [refresh, teamCall],
  )

  const declineInvitation = useCallback(
    async (id: string) => {
      await teamCall(`/teams/invitations/${id}/decline`, 'POST', {})
    },
    [teamCall],
  )

  const joinTeam = useCallback(
    async (code: string) => {
      const data = await teamCall<TeamsPayload & { team: { id: string; name: string } }>('/teams/join', 'POST', { code }, 'No se pudo unir al equipo')
      if (!data) return undefined
      await refresh()
      return data.team
    },
    [refresh, teamCall],
  )

  const leaveTeam = useCallback(
    async (teamId: string, userId: string) => {
      const data = await teamCall(`/teams/${teamId}/members/${userId}`, 'DELETE')
      if (data) await refresh()
    },
    [refresh, teamCall],
  )

  const value = useMemo<PlannerValue>(
    () => ({
      user,
      events: visibleEvents,
      eventsByDate,
      tasks,
      teams,
      invitations,
      hiddenCalendars,
      toggleCalendar,
      theme,
      hapticsEnabled,
      now,
      notify,
      setTheme,
      setHaptics,
      addEvent,
      saveEvent,
      moveEvent,
      duplicateEvent,
      deleteEvent,
      restoreEvent,
      toggleChecklist,
      addChecklistItem,
      addTask,
      toggleTask,
      updateTask,
      deleteTask,
      restoreTask,
      scheduleTask,
      unscheduleTask,
      refresh,
      createTeam,
      updateTeam,
      deleteTeam,
      regenerateCode,
      inviteToTeam,
      removeInvite,
      acceptInvitation,
      declineInvitation,
      joinTeam,
      leaveTeam,
    }),
    [
      user,
      visibleEvents,
      eventsByDate,
      tasks,
      teams,
      invitations,
      hiddenCalendars,
      toggleCalendar,
      createTeam,
      updateTeam,
      deleteTeam,
      regenerateCode,
      inviteToTeam,
      removeInvite,
      acceptInvitation,
      declineInvitation,
      joinTeam,
      leaveTeam,
      theme,
      hapticsEnabled,
      now,
      notify,
      setTheme,
      setHaptics,
      addEvent,
      saveEvent,
      moveEvent,
      duplicateEvent,
      deleteEvent,
      restoreEvent,
      toggleChecklist,
      addChecklistItem,
      addTask,
      toggleTask,
      updateTask,
      deleteTask,
      restoreTask,
      scheduleTask,
      unscheduleTask,
      refresh,
    ],
  )

  if (loading) return <Splash label="Cargando tu agenda…" />
  if (loadError) {
    return (
      <LoadError
        message={loadError}
        onRetry={() => void loadData()}
        onLogout={() => void logout()}
      />
    )
  }

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner() {
  const context = useContext(PlannerContext)
  if (!context) throw new Error('usePlanner debe usarse dentro de PlannerProvider')
  return context
}
