import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import request from 'supertest'
import { createApp } from '../src/app'
import { createPrisma } from '../src/db'

const prisma = createPrisma()
const app = createApp(prisma)
const csrf = { 'X-Requested-With': 'XMLHttpRequest' }
const password = 'una-clave-larga-123'

const email = () =>
  `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pulso.local`

async function register(name = 'Daniel') {
  const agent = request.agent(app)
  const address = email()
  const response = await agent
    .post('/api/auth/register')
    .set(csrf)
    .send({ name, email: address, password })
  assert.equal(response.status, 201)
  return { agent, email: address, user: response.body.user }
}

after(async () => {
  await prisma.$disconnect()
})

test('health responde sin autenticación', async () => {
  const response = await request(app).get('/api/health')
  assert.equal(response.status, 200)
  assert.equal(response.body.ok, true)
  assert.equal(response.body.db, true)
})

test('los endpoints privados exigen sesión', async () => {
  const response = await request(app).get('/api/events')
  assert.equal(response.status, 401)
  assert.equal(response.body.code, 'NO_TOKEN')
})

test('registro, sesión y datos de bienvenida', async () => {
  const { agent, email: address, user } = await register()

  assert.equal(user.email, address)
  assert.ok(user.id)
  assert.equal(user.passwordHash, undefined)

  const me = await agent.get('/api/auth/me')
  assert.equal(me.status, 200)
  assert.equal(me.body.user.email, address)

  const bootstrap = await agent.get('/api/bootstrap')
  assert.equal(bootstrap.status, 200)
  assert.equal(bootstrap.body.events.length, 2)
  assert.deepEqual(
    bootstrap.body.events.map((e: { title: string }) => e.title).sort(),
    ["Bienvenido a MessOff", "Cómo usar MessOff"],
  )
  assert.equal(bootstrap.body.tasks.length, 3)
})

test('CSRF: una mutación con cookie necesita la cabecera', async () => {
  const { agent } = await register()
  const response = await agent.post('/api/events').send({
    title: 'Sin cabecera',
    date: '2030-02-14',
    start: 600,
    duration: 60,
  })
  assert.equal(response.status, 403)
  assert.equal(response.body.code, 'CSRF')
})

test('CRUD de eventos, movimiento y duplicado', async () => {
  const { agent } = await register()
  const eventId = crypto.randomUUID()
  const checklistId = crypto.randomUUID()

  const created = await agent
    .post('/api/events')
    .set(csrf)
    .send({
      id: eventId,
      title: 'Revisión real',
      date: '2030-02-14',
      start: 10 * 60,
      duration: 90,
      category: 'trabajo',
      location: 'Sala 1',
      attendees: ['Marta'],
      checklist: [{ id: checklistId, text: 'Llevar notas', done: false }],
    })
  assert.equal(created.status, 201)
  assert.equal(created.body.event.id, eventId)
  assert.equal(created.body.event.checklist[0].id, checklistId)

  const moved = await agent
    .patch(`/api/events/${eventId}`)
    .set(csrf)
    .send({ date: '2030-02-15', start: 11 * 60 })
  assert.equal(moved.status, 200)
  assert.equal(moved.body.event.date, '2030-02-15')
  assert.equal(moved.body.event.start, 11 * 60)

  const copy = await agent.post(`/api/events/${eventId}/duplicate`).set(csrf)
  assert.equal(copy.status, 201)
  assert.notEqual(copy.body.event.id, eventId)
  assert.match(copy.body.event.title, /\(copia\)$/)

  const list = await agent.get('/api/events')
  assert.equal(list.status, 200)
  assert.ok(list.body.events.some((item: { id: string }) => item.id === eventId))

  const deleted = await agent.delete(`/api/events/${eventId}`).set(csrf)
  assert.equal(deleted.status, 200)
  const afterDelete = await agent.get('/api/events')
  assert.ok(!afterDelete.body.events.some((item: { id: string }) => item.id === eventId))
})

test('programar una tarea crea un evento y la cierra', async () => {
  const { agent } = await register()
  const taskId = crypto.randomUUID()

  const task = await agent
    .post('/api/tasks')
    .set(csrf)
    .send({
      id: taskId,
      title: 'Llamar al seguro',
      due: '2030-02-14',
      tag: 'personal',
    })
  assert.equal(task.status, 201)

  const scheduled = await agent.post(`/api/tasks/${taskId}/schedule`).set(csrf).send({})
  assert.equal(scheduled.status, 201)
  assert.equal(scheduled.body.event.date, '2030-02-14')
  assert.equal(scheduled.body.event.start, 9 * 60)
  assert.equal(scheduled.body.task.done, true)
})

test('login correcto, login incorrecto y logout', async () => {
  const { agent, email: address } = await register('Marta')
  await agent.post('/api/auth/logout').set(csrf)

  const bad = await request(app)
    .post('/api/auth/login')
    .set(csrf)
    .send({ email: address, password: 'no-es-la-clave' })
  assert.equal(bad.status, 401)

  const good = await request(app)
    .post('/api/auth/login')
    .set(csrf)
    .send({ email: address, password })
  assert.equal(good.status, 200)
  assert.equal(good.body.user.email, address)
})

test('eliminar la cuenta borra la sesión', async () => {
  const { agent } = await register('Temporal')
  const removed = await agent.post('/api/auth/delete').set(csrf).send({ password })
  assert.equal(removed.status, 200)
  const me = await agent.get('/api/auth/me')
  assert.equal(me.status, 401)
})

test('cambiar contraseña mantiene esta sesión y permite entrar con la nueva', async () => {
  const { agent, email: address } = await register('Cambio')
  const wrong = await agent
    .patch('/api/auth/password')
    .set(csrf)
    .send({ currentPassword: 'no-es-la-actual', newPassword: 'nueva-clave-larga-123' })
  assert.equal(wrong.status, 400)

  const changed = await agent
    .patch('/api/auth/password')
    .set(csrf)
    .send({ currentPassword: password, newPassword: 'nueva-clave-larga-123' })
  assert.equal(changed.status, 200)

  const me = await agent.get('/api/auth/me')
  assert.equal(me.status, 200)

  const oldLogin = await request(app)
    .post('/api/auth/login')
    .set(csrf)
    .send({ email: address, password })
  assert.equal(oldLogin.status, 401)

  const newLogin = await request(app)
    .post('/api/auth/login')
    .set(csrf)
    .send({ email: address, password: 'nueva-clave-larga-123' })
  assert.equal(newLogin.status, 200)
})

test('las sesiones de enfoque se guardan por fecha', async () => {
  const { agent } = await register('Foco')
  const created = await agent
    .post('/api/focus-sessions')
    .set(csrf)
    .send({ minutes: 25 })
  assert.equal(created.status, 201)

  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TZ || 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const list = await agent.get(`/api/focus-sessions?date=${day}`)
  assert.equal(list.status, 200)
  assert.ok(
    list.body.sessions.some(
      (session: { id: string }) => session.id === created.body.session.id,
    ),
  )
})
