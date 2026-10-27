export type Category = 'trabajo' | 'personal' | 'salud' | 'social'

export type ChecklistItem = {
  id: string
  text: string
  done: boolean
}

export type CalEvent = {
  id: string
  title: string
  date: string // YYYY-MM-DD
  start: number // minutes from midnight
  duration: number // minutes
  category: Category
  location?: string
  note?: string
  attendees?: string[]
  checklist?: ChecklistItem[]
}

export type Task = {
  id: string
  title: string
  due: string | null
  tag: Category
  done: boolean
}

export type ToastState = {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
} | null

export type User = {
  id: string
  name: string
  email: string
  theme: Theme
  haptics: boolean
  createdAt?: string
}

export type FocusSession = {
  id: string
  minutes: number
  completedAt: string
}

export type View = 'hoy' | 'calendario' | 'tareas' | 'enfoque'
export type CalView = 'dia' | 'semana' | 'mes'
export type Theme = 'paper' | 'night'

export type HapticKind =
  | 'selection'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'nudge'
  | 'soft'
  | 'rigid'
  | 'tick'
  | 'snap'
  | 'swipe'
  | 'heartbeat'
  | 'celebrate'
