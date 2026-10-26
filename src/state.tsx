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
import type { CalEvent, Category, ChecklistItem, Task, Theme, ToastState, User } from './types'
import { api, ApiError } from './lib/api'
import { useAuth } from './auth'
import { setHapticsEnabled as applyHaptics } from './lib/haptics'
import { LoadError, Splash } from './components/Loading'

type PlannerValue = {
  user: User
  events: CalEvent[]
  tasks: Task[]
  theme: Theme
  hapticsEnabled: boolean
  now: Date
  toast: ToastState
  notify: (message: string, actionLabel?: string, onAction?: () => void) => void
  dismissToast: () => void
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
  deleteTask: (id: string) => void
  scheduleTask: (id: string) => Promise<CalEvent | undefined>
}

const PlannerContext = createContext<PlannerValue | null>(null)

const uid = () => crypto.randomUUID()

export function PlannerProvider({ user, children }: { user: User; children: ReactNode }) {
  const { setUser, logout } = useAuth()
  const [events, setEvents] = useState<CalEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [now, setNow] = useState(() => new Date())
  const toastTimer = useRef<number | null>(null)
  const saveTimers = useRef<Map<string, number>>(new Map())

  const theme = (user.theme === 'night' ? 'night' : 'paper') as Theme
  const hapticsEnabled = user.haptics

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('pulso.theme', theme)
    } catch {
      /* almacenamiento no disponible */
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'night' ? '#14130f' : '#f1ede2')
  }, [theme])

  useEffect(() => {
    applyHaptics(user.haptics)
  }, [user.haptics])

  useEffect(
    () => () => {
      for (const timer of saveTimers.current.values()) window.clearTimeout(timer)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const notify = useCallback(
    (message: string, actionLabel?: string, onAction?: () => void) => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      setToast({ id: Date.now(), message, actionLabel, onAction })
      toastTimer.current = window.setTimeout(() => setToast(null), 5200)
    },
    [],
  )

  const dismissToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const fail = useCallback(
    (error: unknown, fallback: string): never | void => {
      if (error instanceof ApiError && error.status === 401) {
        void logout()
        return
      }
      notify(error instanceof ApiError ? error.message : fallback)
    },
    [logout, notify],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api<{ user: User; events: CalEvent[]; tasks: Task[] }>('/bootstrap')
      setEvents(data.events)
      setTasks(data.tasks)
      setUser(data.user)
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

  useEffect(() => {
    void loadData()
  }, [loadData])

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
      const event: CalEvent = { ...input, id: uid() }
      setEvents((list) => [...list, event])
      void api<{ event: CalEvent }>('/events', { method: 'POST', body: event }).catch(
        (error) => {
          setEvents((list) => list.filter((item) => item.id !== event.id))
          fail(error, 'No se pudo crear el evento')
        },
      )
      return event
    },
    [fail],
  )

  const saveEvent = useCallback(
    (next: CalEvent) => {
      setEvents((list) => list.map((event) => (event.id === next.id ? next : event)))
      const timer = saveTimers.current.get(next.id)
      if (timer) window.clearTimeout(timer)
      const handle = window.setTimeout(() => {
        saveTimers.current.delete(next.id)
        void api<{ event: CalEvent }>(`/events/${next.id}`, {
          method: 'PATCH',
          body: next,
        }).catch((error) => {
          fail(error, 'No se pudo guardar el evento')
          void loadData()
        })
      }, 350)
      saveTimers.current.set(next.id, handle)
    },
    [fail, loadData],
  )

  const moveEvent = useCallback(
    (id: string, date: string, start: number) => {
      const previous = events.find((event) => event.id === id)
      if (!previous) return undefined
      if (previous.date === date && previous.start === start) return previous

      const timer = saveTimers.current.get(id)
      if (timer) window.clearTimeout(timer)
      saveTimers.current.delete(id)

      const next = { ...previous, date, start }
      setEvents((list) => list.map((event) => (event.id === id ? next : event)))
      void api<{ event: CalEvent }>(`/events/${id}`, {
        method: 'PATCH',
        body: next,
      }).catch((error) => {
        setEvents((list) => list.map((event) => (event.id === id ? previous : event)))
        fail(error, 'No se pudo mover el evento')
      })
      return previous
    },
    [events, fail],
  )

  const duplicateEvent = useCallback(
    async (id: string) => {
      try {
        const data = await api<{ event: CalEvent }>(`/events/${id}/duplicate`, {
          method: 'POST',
        })
        setEvents((list) => [...list, data.event])
        return data.event
      } catch (error) {
        fail(error, 'No se pudo duplicar el evento')
        return undefined
      }
    },
    [fail],
  )

  const deleteEvent = useCallback(
    (id: string) => {
      const previous = events.find((event) => event.id === id)
      if (!previous) return undefined
      const timer = saveTimers.current.get(id)
      if (timer) window.clearTimeout(timer)
      saveTimers.current.delete(id)
      setEvents((list) => list.filter((event) => event.id !== id))
      void api(`/events/${id}`, { method: 'DELETE' }).catch((error) => {
        setEvents((list) => [...list, previous])
        fail(error, 'No se pudo eliminar el evento')
      })
      return previous
    },
    [events, fail],
  )

  const restoreEvent = useCallback(
    (event: CalEvent) => {
      setEvents((list) =>
        list.some((item) => item.id === event.id) ? list : [...list, event],
      )
      void api<{ event: CalEvent }>('/events', { method: 'POST', body: event }).catch(
        (error) => {
          setEvents((list) => list.filter((item) => item.id !== event.id))
          fail(error, 'No se pudo restaurar el evento')
        },
      )
    },
    [fail],
  )

  const toggleChecklist = useCallback(
    (eventId: string, itemId: string) => {
      const event = events.find((item) => item.id === eventId)
      if (!event) return
      saveEvent({
        ...event,
        checklist: (event.checklist ?? []).map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item,
        ),
      })
    },
    [events, saveEvent],
  )

  const addChecklistItem = useCallback(
    (eventId: string, text: string) => {
      const event = events.find((item) => item.id === eventId)
      if (!event) return
      const item: ChecklistItem = { id: uid(), text, done: false }
      saveEvent({ ...event, checklist: [...(event.checklist ?? []), item] })
    },
    [events, saveEvent],
  )

  const addTask = useCallback(
    (title: string, due: string | null, tag: Category) => {
      const task: Task = { id: uid(), title, due, tag, done: false }
      setTasks((list) => [task, ...list])
      void api<{ task: Task }>('/tasks', { method: 'POST', body: task }).catch((error) => {
        setTasks((list) => list.filter((item) => item.id !== task.id))
        fail(error, 'No se pudo crear la tarea')
      })
      return task
    },
    [fail],
  )

  const toggleTask = useCallback(
    (id: string) => {
      const previous = tasks.find((task) => task.id === id)
      if (!previous) return
      const next = { ...previous, done: !previous.done }
      setTasks((list) => list.map((task) => (task.id === id ? next : task)))
      void api(`/tasks/${id}`, {
        method: 'PATCH',
        body: { done: next.done },
      }).catch((error) => {
        setTasks((list) => list.map((task) => (task.id === id ? previous : task)))
        fail(error, 'No se pudo actualizar la tarea')
      })
    },
    [fail, tasks],
  )

  const deleteTask = useCallback(
    (id: string) => {
      const previous = tasks.find((task) => task.id === id)
      if (!previous) return
      setTasks((list) => list.filter((task) => task.id !== id))
      void api(`/tasks/${id}`, { method: 'DELETE' }).catch((error) => {
        setTasks((list) => [...list, previous])
        fail(error, 'No se pudo eliminar la tarea')
      })
    },
    [fail, tasks],
  )

  const scheduleTask = useCallback(
    async (id: string) => {
      try {
        const data = await api<{ event: CalEvent; task: Task }>(
          `/tasks/${id}/schedule`,
          { method: 'POST', body: {} },
        )
        setEvents((list) => [...list, data.event])
        setTasks((list) => list.map((task) => (task.id === id ? data.task : task)))
        return data.event
      } catch (error) {
        fail(error, 'No se pudo programar la tarea')
        return undefined
      }
    },
    [fail],
  )

  const value = useMemo<PlannerValue>(
    () => ({
      user,
      events,
      tasks,
      theme,
      hapticsEnabled,
      now,
      toast,
      notify,
      dismissToast,
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
      deleteTask,
      scheduleTask,
    }),
    [
      user,
      events,
      tasks,
      theme,
      hapticsEnabled,
      now,
      toast,
      notify,
      dismissToast,
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
      deleteTask,
      scheduleTask,
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
