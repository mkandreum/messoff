import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import request from 'supertest'
import { createApp } from '../src/app'
import { createPrisma } from '../src/db'
import { occursOn } from '../src/recurrence'

const prisma = createPrisma()
const app = createApp(prisma)
const csrf = { 'X-Requested-With': 'XMLHttpRequest' }

async function register() {
  const agent = request.agent(app)
  const email = `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pulso.local`
  const response = await agent
    .post('/api/auth/register')
    .set(csrf)
    .send({ name: 'Ana', email, password: 'una-clave-larga-123' })
  assert.equal(response.status, 201)
  return agent
}

after(async () => {
  await prisma.$disconnect()
})

test('occursOn sigue las reglas de repetición', () => {
  const weekly = { date: '2026-11-05', repeat: 'weekly', repeatUntil: '2026-11-30', repeatSkip: ['2026-11-12'] }
  assert.equal(occursOn(weekly, '2026-11-05'), true)
  assert.equal(occursOn(weekly, '2026-11-12'), false)
  assert.equal(occursOn(weekly, '2026-11-19'), true)
  assert.equal(occursOn(weekly, '2026-11-20'), false)
  assert.equal(occursOn(weekly, '2026-12-03'), false)
  const weekdays = { date: '2026-11-06', repeat: 'weekdays', repeatUntil: null, repeatSkip: [] }
  assert.equal(occursOn(weekdays, '2026-11-07'), false)
  assert.equal(occursOn(weekdays, '2026-11-09'), true)
})

test('un evento guarda repetición y aviso', async () => {
  const agent = await register()
  const id = crypto.randomUUID()
  const created = await agent.post('/api/events').set(csrf).send({
    id,
    title: 'Reunión semanal',
    date: '2026-11-05',
    start: 1170,
    duration: 120,
    repeat: 'weekly',
    remind: 10,
  })
  assert.equal(created.status, 201)
  assert.equal(created.body.event.repeat, 'weekly')
  assert.equal(created.body.event.remind, 10)
  assert.deepEqual(created.body.event.repeatSkip, [])

  const patched = await agent
    .patch(`/api/events/${id}`)
    .set(csrf)
    .send({ repeatSkip: ['2026-11-12'], repeatUntil: '2027-01-01' })
  assert.equal(patched.status, 200)
  assert.deepEqual(patched.body.event.repeatSkip, ['2026-11-12'])
  assert.equal(patched.body.event.repeatUntil, '2027-01-01')

  const invalid = await agent.patch(`/api/events/${id}`).set(csrf).send({ repeat: 'hourly' })
  assert.equal(invalid.status, 400)
})

test('programar una tarea respeta los eventos repetidos', async () => {
  const agent = await register()
  const today = new Date().toISOString().slice(0, 10)
  const blocked = await agent.post('/api/events').set(csrf).send({
    title: 'Bloqueo',
    date: '2020-01-01',
    start: 540,
    duration: 660,
    repeat: 'daily',
  })
  assert.equal(blocked.status, 201)
  const task = await agent.post('/api/tasks').set(csrf).send({ title: 'Algo', due: today })
  assert.equal(task.status, 201)
  const scheduled = await agent.post(`/api/tasks/${task.body.task.id}/schedule`).set(csrf).send({})
  assert.equal(scheduled.status, 409)
})

test('el enlace ICS se crea, se sirve sin sesión y se puede revocar', async () => {
  const agent = await register()
  assert.equal((await agent.get('/api/calendar/link')).body.url, null)
  await agent.post('/api/events').set(csrf).send({
    title: 'Cena, con; Ana',
    date: '2026-11-05',
    start: 1170,
    duration: 60,
    repeat: 'weekly',
    repeatUntil: '2026-12-31',
    repeatSkip: ['2026-11-12'],
    remind: 30,
  })

  const link = await agent.post('/api/calendar/link').set(csrf).send({})
  assert.equal(link.status, 200)
  const path = new URL(link.body.url).pathname

  const feed = await request(app).get(path)
  assert.equal(feed.status, 200)
  assert.match(feed.headers['content-type'], /text\/calendar/)
  assert.match(feed.text, /SUMMARY:Cena\\, con\\; Ana/)
  assert.match(feed.text, /DTSTART:20261105T193000/)
  assert.match(feed.text, /RRULE:FREQ=WEEKLY;UNTIL=20261231T235959/)
  assert.match(feed.text, /EXDATE:20261112T193000/)
  assert.match(feed.text, /TRIGGER:-PT30M/)

  const revoked = await agent.delete('/api/calendar/link').set(csrf)
  assert.equal(revoked.status, 200)
  assert.equal((await request(app).get(path)).status, 404)
})
