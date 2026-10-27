import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app'
import { createPrisma } from '../src/db'

const prisma = createPrisma()
const app = createApp(prisma)
const csrf = { 'X-Requested-With': 'XMLHttpRequest' }
const password = 'una-clave-larga-123'

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function register(name: string, address = `eq-${unique()}@messoff.local`) {
  const agent = request.agent(app)
  const response = await agent.post('/api/auth/register').set(csrf).send({ name, email: address, password })
  assert.equal(response.status, 201)
  return { agent, email: address, id: response.body.user.id as string }
}

after(async () => {
  await prisma.$disconnect()
})

test('equipo: invitar a alguien sin cuenta, que se registre y comparta calendario', async () => {
  const owner = await register('Marta')
  const created = await owner.agent.post('/api/teams').set(csrf).send({ name: 'Diseño', color: 'verde' })
  assert.equal(created.status, 201)
  const teamId = created.body.team.id as string
  assert.equal(created.body.teams[0].role, 'owner')

  // Invitación a un email que todavía no existe
  const futureEmail = `nuevo-${unique()}@messoff.local`
  const invited = await owner.agent.post(`/api/teams/${teamId}/invites`).set(csrf).send({ email: futureEmail })
  assert.equal(invited.status, 201)
  assert.equal(invited.body.registered, false)
  assert.equal(invited.body.teams[0].invites[0].email, futureEmail)

  // La persona se registra con ese email y ve la invitación pendiente
  const guest = await register('Luis', futureEmail)
  const pending = await guest.agent.get('/api/teams')
  assert.equal(pending.body.invitations.length, 1)
  assert.equal(pending.body.invitations[0].teamName, 'Diseño')
  assert.equal(pending.body.teams.length, 0)

  const accepted = await guest.agent
    .post(`/api/teams/invitations/${pending.body.invitations[0].id}/accept`)
    .set(csrf)
  assert.equal(accepted.status, 200)
  assert.equal(accepted.body.teams.length, 1)
  assert.equal(accepted.body.teams[0].role, 'member')
  assert.equal(accepted.body.teams[0].members.length, 2)
  assert.equal(accepted.body.invitations.length, 0)

  // Evento compartido: lo ven los dos y lo puede editar quien no lo creó
  const event = await owner.agent.post('/api/events').set(csrf).send({
    title: 'Revisión de marca',
    date: '2030-03-04',
    start: 600,
    duration: 60,
    teamId,
  })
  assert.equal(event.status, 201)
  assert.equal(event.body.event.teamId, teamId)
  assert.equal(event.body.event.authorName, 'Marta')

  const seen = await guest.agent.get('/api/bootstrap')
  assert.ok(seen.body.events.some((e: { id: string }) => e.id === event.body.event.id))

  const edited = await guest.agent
    .patch(`/api/events/${event.body.event.id}`)
    .set(csrf)
    .send({ title: 'Revisión de marca v2' })
  assert.equal(edited.status, 200)
  assert.equal(edited.body.event.title, 'Revisión de marca v2')

  // Pero no puede mover el evento a otro calendario
  const moved = await guest.agent
    .patch(`/api/events/${event.body.event.id}`)
    .set(csrf)
    .send({ teamId: null })
  assert.equal(moved.status, 403)

  // Un tercero no ve nada
  const outsider = await register('Ajeno')
  const hidden = await outsider.agent.get('/api/bootstrap')
  assert.ok(!hidden.body.events.some((e: { id: string }) => e.id === event.body.event.id))
  const blocked = await outsider.agent.patch(`/api/events/${event.body.event.id}`).set(csrf).send({ title: 'x' })
  assert.equal(blocked.status, 404)
})

test('equipo: no se puede crear un evento en un equipo ajeno', async () => {
  const owner = await register('Ana')
  const created = await owner.agent.post('/api/teams').set(csrf).send({ name: 'Privado' })
  const outsider = await register('Pepe')
  const response = await outsider.agent.post('/api/events').set(csrf).send({
    title: 'Colado',
    date: '2030-03-04',
    start: 600,
    duration: 30,
    teamId: created.body.team.id,
  })
  assert.equal(response.status, 403)
})

test('equipo: unirse con código, salir y que sus eventos vuelvan a ser personales', async () => {
  const owner = await register('Carla')
  const created = await owner.agent.post('/api/teams').set(csrf).send({ name: 'Familia' })
  const teamId = created.body.team.id as string
  const code = created.body.teams[0].joinCode as string

  const bad = await (await register('Intruso')).agent.post('/api/teams/join').set(csrf).send({ code: 'no-existe-123' })
  assert.equal(bad.status, 404)

  const member = await register('Dani')
  const joined = await member.agent.post('/api/teams/join').set(csrf).send({ code })
  assert.equal(joined.status, 200)
  assert.equal(joined.body.teams[0].members.length, 2)

  const event = await member.agent.post('/api/events').set(csrf).send({
    title: 'Cena familiar',
    date: '2030-03-05',
    start: 1260,
    duration: 90,
    teamId,
  })
  assert.equal(event.status, 201)

  // Quien lo creó no puede abandonar; el resto sí
  const ownerLeave = await owner.agent.delete(`/api/teams/${teamId}/members/${owner.id}`).set(csrf)
  assert.equal(ownerLeave.status, 409)

  const left = await member.agent.delete(`/api/teams/${teamId}/members/${member.id}`).set(csrf)
  assert.equal(left.status, 200)
  assert.equal(left.body.teams.length, 0)

  const mine = await member.agent.get('/api/bootstrap')
  const kept = mine.body.events.find((e: { id: string }) => e.id === event.body.event.id)
  assert.ok(kept)
  assert.equal(kept.teamId, null)

  const ownerView = await owner.agent.get('/api/bootstrap')
  assert.ok(!ownerView.body.events.some((e: { id: string }) => e.id === event.body.event.id))
})

test('equipo: solo quien lo creó invita, cambia el nombre o lo elimina', async () => {
  const owner = await register('Jefa')
  const created = await owner.agent.post('/api/teams').set(csrf).send({ name: 'Ventas' })
  const teamId = created.body.team.id as string
  const member = await register('Equipo')
  await member.agent.post('/api/teams/join').set(csrf).send({ code: created.body.teams[0].joinCode })

  const invite = await member.agent.post(`/api/teams/${teamId}/invites`).set(csrf).send({ email: 'otro@messoff.local' })
  assert.equal(invite.status, 403)
  const rename = await member.agent.patch(`/api/teams/${teamId}`).set(csrf).send({ name: 'Mío' })
  assert.equal(rename.status, 403)
  const remove = await member.agent.delete(`/api/teams/${teamId}`).set(csrf)
  assert.equal(remove.status, 403)

  const renamed = await owner.agent.patch(`/api/teams/${teamId}`).set(csrf).send({ name: 'Ventas EMEA', color: 'ocre' })
  assert.equal(renamed.status, 200)
  assert.equal(renamed.body.teams[0].name, 'Ventas EMEA')

  const removed = await owner.agent.delete(`/api/teams/${teamId}`).set(csrf)
  assert.equal(removed.status, 200)
  assert.equal(removed.body.teams.length, 0)
  const gone = await member.agent.get('/api/teams')
  assert.equal(gone.body.teams.length, 0)
})
