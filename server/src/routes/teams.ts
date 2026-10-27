import crypto from 'node:crypto'
import { Router } from 'express'
import type { PrismaClient, User } from '@prisma/client'
import { requireAuth, type AuthedRequest } from '../auth'
import { asyncHandler, HttpError } from '../errors'
import { inviteSchema, joinSchema, parse, teamInputSchema, teamPatchSchema } from '../validation'

const newCode = () => crypto.randomBytes(6).toString('base64url')

const teamInclude = {
  members: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: 'asc' as const },
  },
  invites: { orderBy: { createdAt: 'asc' as const } },
}

/** Equipos del usuario y las invitaciones pendientes a su email. */
export async function loadTeams(prisma: PrismaClient, user: User) {
  const [memberships, invitations] = await Promise.all([
    prisma.teamMember.findMany({
      where: { userId: user.id },
      include: { team: { include: teamInclude } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.teamInvite.findMany({
      where: { email: user.email.toLowerCase() },
      include: {
        team: { select: { id: true, name: true, color: true } },
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  return {
    teams: memberships.map(({ team, role }) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      role,
      joinCode: team.joinCode,
      members: team.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      invites: role === 'owner' ? team.invites.map((i) => ({ id: i.id, email: i.email })) : [],
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      teamId: i.team.id,
      teamName: i.team.name,
      color: i.team.color,
      invitedBy: i.invitedBy.name,
    })),
  }
}

export function createTeamsRouter(prisma: PrismaClient) {
  const router = Router()
  router.use(requireAuth(prisma))

  const me = (req: unknown) => (req as AuthedRequest).user

  const findMember = (teamId: string, userId: string) =>
    prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } })

  const requireOwner = async (teamId: string, userId: string) => {
    const member = await findMember(teamId, userId)
    if (!member) throw new HttpError(404, 'Ese equipo no existe.', 'NOT_FOUND')
    if (member.role !== 'owner') {
      throw new HttpError(403, 'Solo quien creó el equipo puede hacer esto.', 'FORBIDDEN')
    }
  }

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await loadTeams(prisma, me(req)))
    }),
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const user = me(req)
      const body = parse(teamInputSchema, req.body)
      const count = await prisma.teamMember.count({ where: { userId: user.id, role: 'owner' } })
      if (count >= 20) throw new HttpError(409, 'Has alcanzado el máximo de equipos.', 'LIMIT')
      const team = await prisma.team.create({
        data: {
          name: body.name,
          color: body.color ?? 'azul',
          joinCode: newCode(),
          members: { create: { userId: user.id, role: 'owner' } },
        },
      })
      res.status(201).json({ team: { id: team.id }, ...(await loadTeams(prisma, user)) })
    }),
  )

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = me(req)
      await requireOwner(req.params.id, user.id)
      const body = parse(teamPatchSchema, req.body)
      await prisma.team.update({ where: { id: req.params.id }, data: body })
      res.json(await loadTeams(prisma, user))
    }),
  )

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = me(req)
      await requireOwner(req.params.id, user.id)
      await prisma.team.delete({ where: { id: req.params.id } })
      res.json(await loadTeams(prisma, user))
    }),
  )

  router.post(
    '/:id/code',
    asyncHandler(async (req, res) => {
      const user = me(req)
      await requireOwner(req.params.id, user.id)
      await prisma.team.update({ where: { id: req.params.id }, data: { joinCode: newCode() } })
      res.json(await loadTeams(prisma, user))
    }),
  )

  router.post(
    '/:id/invites',
    asyncHandler(async (req, res) => {
      const user = me(req)
      await requireOwner(req.params.id, user.id)
      const { email } = parse(inviteSchema, req.body)
      const target = await prisma.user.findUnique({ where: { email } })
      if (target && (await findMember(req.params.id, target.id))) {
        throw new HttpError(409, 'Esa persona ya está en el equipo.', 'ALREADY_MEMBER')
      }
      await prisma.teamInvite.upsert({
        where: { teamId_email: { teamId: req.params.id, email } },
        update: {},
        create: { teamId: req.params.id, email, invitedById: user.id },
      })
      res.status(201).json({ registered: !!target, ...(await loadTeams(prisma, user)) })
    }),
  )

  router.delete(
    '/:id/invites/:inviteId',
    asyncHandler(async (req, res) => {
      const user = me(req)
      await requireOwner(req.params.id, user.id)
      await prisma.teamInvite.deleteMany({ where: { id: req.params.inviteId, teamId: req.params.id } })
      res.json(await loadTeams(prisma, user))
    }),
  )

  router.post(
    '/invitations/:inviteId/accept',
    asyncHandler(async (req, res) => {
      const user = me(req)
      const invite = await prisma.teamInvite.findFirst({
        where: { id: req.params.inviteId, email: user.email.toLowerCase() },
      })
      if (!invite) throw new HttpError(404, 'Esa invitación ya no existe.', 'NOT_FOUND')
      await prisma.$transaction([
        prisma.teamMember.upsert({
          where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
          update: {},
          create: { teamId: invite.teamId, userId: user.id, role: 'member' },
        }),
        prisma.teamInvite.delete({ where: { id: invite.id } }),
      ])
      res.json(await loadTeams(prisma, user))
    }),
  )

  router.post(
    '/invitations/:inviteId/decline',
    asyncHandler(async (req, res) => {
      const user = me(req)
      await prisma.teamInvite.deleteMany({
        where: { id: req.params.inviteId, email: user.email.toLowerCase() },
      })
      res.json(await loadTeams(prisma, user))
    }),
  )

  router.post(
    '/join',
    asyncHandler(async (req, res) => {
      const user = me(req)
      const { code } = parse(joinSchema, req.body)
      const team = await prisma.team.findUnique({ where: { joinCode: code } })
      if (!team) throw new HttpError(404, 'Ese código no es válido o ha caducado.', 'BAD_CODE')
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: user.id } },
        update: {},
        create: { teamId: team.id, userId: user.id, role: 'member' },
      })
      await prisma.teamInvite.deleteMany({ where: { teamId: team.id, email: user.email.toLowerCase() } })
      res.json({ team: { id: team.id, name: team.name }, ...(await loadTeams(prisma, user)) })
    }),
  )

  /** Salir del equipo (uno mismo) o quitar a alguien (solo quien lo creó). */
  router.delete(
    '/:id/members/:userId',
    asyncHandler(async (req, res) => {
      const user = me(req)
      const target = req.params.userId
      if (target !== user.id) await requireOwner(req.params.id, user.id)
      const member = await findMember(req.params.id, target)
      if (!member) throw new HttpError(404, 'Esa persona no está en el equipo.', 'NOT_FOUND')
      if (member.role === 'owner') {
        throw new HttpError(409, 'Quien creó el equipo no puede salir: elimina el equipo.', 'OWNER_CANNOT_LEAVE')
      }
      await prisma.$transaction([
        // Lo que esa persona creó vuelve a su calendario personal.
        prisma.event.updateMany({ where: { teamId: req.params.id, userId: target }, data: { teamId: null } }),
        prisma.teamMember.delete({ where: { teamId_userId: { teamId: req.params.id, userId: target } } }),
      ])
      res.json(await loadTeams(prisma, user))
    }),
  )

  return router
}
