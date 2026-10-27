import { z } from 'zod'
import { HttpError } from './errors'

export const CATEGORIES = ['trabajo', 'personal', 'salud', 'social'] as const
export const THEMES = ['paper', 'night'] as const
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const category = z.enum(CATEGORIES, { message: 'Categoría no válida' })

const date = z
  .string()
  .regex(DATE_RE, 'La fecha debe tener el formato YYYY-MM-DD')

const checklistItem = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  text: z.string().trim().min(1, 'La subtarea no puede estar vacía').max(200),
  done: z.boolean().optional(),
})

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Escribe tu nombre').max(60, 'El nombre es demasiado largo'),
  email: z.string().trim().email('El email no es válido').max(254),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña es demasiado larga'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('El email no es válido').max(254),
  password: z.string().min(1, 'Escribe tu contraseña').max(128),
})

export const profileSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(60).optional(),
    theme: z.enum(THEMES).optional(),
    haptics: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No hay cambios que guardar',
  })

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual').max(128),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(128),
})

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Escribe tu contraseña').max(128),
})

export const eventInputSchema = z
  .object({
    id: z.string().uuid('El identificador del evento no es válido').optional(),
    title: z.string().trim().min(1, 'El evento necesita un título').max(160),
    date,
    start: z.number().int().min(0, 'La hora no es válida').max(1439),
    duration: z.number().int().min(5, 'La duración mínima es 5 minutos').max(1440),
    category: category.optional(),
    location: z.string().trim().max(200).optional(),
    note: z.string().max(5000).optional(),
    attendees: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    checklist: z.array(checklistItem).max(50).optional(),
    teamId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => value.start + value.duration <= 1440, {
    message: 'El evento no puede terminar después de medianoche',
    path: ['duration'],
  })

export const eventPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    date: date.optional(),
    start: z.number().int().min(0).max(1439).optional(),
    duration: z.number().int().min(5).max(1440).optional(),
    category: category.optional(),
    location: z.string().trim().max(200).optional(),
    note: z.string().max(5000).optional(),
    attendees: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    checklist: z.array(checklistItem).max(50).optional(),
    teamId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No hay cambios que guardar',
  })

export const taskInputSchema = z.object({
  id: z.string().uuid('El identificador de la tarea no es válido').optional(),
  title: z.string().trim().min(1, 'La tarea necesita un título').max(200),
  due: date.nullable().optional(),
  tag: category.optional(),
  done: z.boolean().optional(),
})

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    due: date.nullable().optional(),
    tag: category.optional(),
    done: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No hay cambios que guardar',
  })

export const TEAM_COLORS = ['rojo', 'verde', 'azul', 'ocre', 'violeta', 'grafito'] as const

export const teamInputSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre al equipo').max(50, 'El nombre es demasiado largo'),
  color: z.enum(TEAM_COLORS, { message: 'Color no válido' }).optional(),
})

export const teamPatchSchema = teamInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'No hay cambios que guardar' })

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('El email no es válido').max(254),
})

export const joinSchema = z.object({
  code: z.string().trim().min(4, 'El código no es válido').max(40),
})

export const scheduleSchema = z.object({
  date: date.optional(),
})

export const focusSessionSchema = z.object({
  minutes: z.number().int().min(1).max(240),
})

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new HttpError(400, issue?.message || 'Datos no válidos', 'VALIDATION')
  }
  return result.data
}
