import type { ChecklistItem, Event, FocusSession, Task, User } from '@prisma/client'

export type EventWithChecklist = Event & {
  checklist: ChecklistItem[]
  user?: { id: string; name: string } | null
}

/** Lo que hay que pedir a Prisma para serializar un evento. */
export const eventInclude = {
  checklist: { orderBy: { position: 'asc' as const } },
  user: { select: { id: true, name: true } },
}

export function toApiUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    theme: user.theme === 'night' ? 'night' : 'paper',
    haptics: user.haptics,
    createdAt: user.createdAt,
  }
}

export function toApiEvent(event: EventWithChecklist) {
  return {
    id: event.id,
    title: event.title,
    date: event.date,
    start: event.start,
    duration: event.duration,
    category: event.category,
    location: event.location,
    note: event.note,
    attendees: event.attendees,
    teamId: event.teamId,
    authorId: event.userId,
    authorName: event.user?.name ?? null,
    checklist: [...event.checklist]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ id: item.id, text: item.text, done: item.done })),
  }
}

export function toApiTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    due: task.due,
    tag: task.tag,
    done: task.done,
  }
}

export function toApiSession(session: FocusSession) {
  return {
    id: session.id,
    minutes: session.minutes,
    completedAt: session.completedAt.toISOString(),
  }
}
