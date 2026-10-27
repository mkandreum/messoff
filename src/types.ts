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
  /** Si es de un equipo, lo ven y editan todos sus miembros. */
  teamId?: string | null
  authorId?: string | null
  authorName?: string | null
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
export type CalView = 'dia' | 'semana' | 'agenda' | 'mes'

export type TeamColor = 'rojo' | 'verde' | 'azul' | 'ocre' | 'violeta' | 'grafito'

export type TeamMember = {
  id: string
  name: string
  email: string
  role: 'owner' | 'member'
}

export type Team = {
  id: string
  name: string
  color: TeamColor
  role: 'owner' | 'member'
  joinCode: string
  members: TeamMember[]
  /** Solo las ve quien creó el equipo. */
  invites: { id: string; email: string }[]
}

export type Invitation = {
  id: string
  teamId: string
  teamName: string
  color: TeamColor
  invitedBy: string
}
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
