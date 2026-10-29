import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryPushStore } from './push-store.mjs'
import { createPushService } from './push-service.mjs'
import { createVercelPushHandler } from './vercel-handler.mjs'
import { createNeonPushStore } from './neon-store.mjs'

const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/cloud-test', keys: { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } }
const preferences = { types: ['service'], zones: ['centro'], frequency: 'immediate' }
const setup = (options = {}) => {
  const store = options.store ?? createMemoryPushStore()
  const sent = []
  const service = createPushService({ store, send: async (...args) => sent.push(args), ...options })
  return { store, sent, service }
}
const register = async (service) => (await service.register({ subscription, preferences })).body

test('shared store prevents duplicate endpoint ownership across simultaneous registrations', async () => {
  const { store } = setup()
  const a = setup({ store }).service, b = setup({ store }).service
  const responses = await Promise.all([a.register({ subscription, preferences }), b.register({ subscription, preferences })])
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 403])
  const owner = responses.find((r) => r.status === 201).body
  assert.equal((await b.register({ ...owner, subscription, preferences })).status, 201)
})

test('concurrent cloud instances reserve only one delivery and retain the daily limit', async () => {
  const { store, service, sent } = setup()
  const account = await register(service)
  await service.preferences({ ...account, preferences: { ...preferences, frequency: 'daily' } })
  const second = setup({ store, send: async (...args) => sent.push(args) }).service
  const results = await Promise.all([service.demo({ ...account, type: 'service', zone: 'centro' }), second.demo({ ...account, type: 'service', zone: 'centro' })])
  assert.equal(sent.length, 1)
  assert.ok(results.some((r) => r.body.accepted))
  assert.equal((await second.demo({ ...account, type: 'service', zone: 'centro' })).body.suppressed, true)
})

test('delayed jobs re-read preferences and revocation rather than a stale subscription snapshot', async () => {
  const { service, sent } = setup()
  const account = await register(service)
  const scheduled = await service.demo({ ...account, type: 'service', zone: 'centro', delaySeconds: 10 })
  assert.equal(scheduled.status, 202)
  await service.preferences({ ...account, preferences: { ...preferences, frequency: 'paused' } })
  assert.equal((await scheduled.job.run()).body.suppressed, true)
  assert.equal(sent.length, 0)
  await service.preferences({ ...account, preferences })
  const other = setup()
  const otherAccount = await register(other.service)
  const revoked = await other.service.demo({ ...otherAccount, type: 'service', zone: 'centro', delaySeconds: 10 })
  await other.service.unsubscribe(otherAccount)
  assert.equal((await revoked.job.run()).status, 404)
  assert.equal(other.sent.length, 0)
})

test('provider acceptance is finalized independently of concurrent preference CAS updates', async () => {
  const store = createMemoryPushStore()
  let accepted = false
  const conflicting = { ...store, commit: (...args) => accepted ? Promise.resolve(false) : store.commit(...args) }
  const service = createPushService({ store: conflicting, send: async () => { accepted = true } })
  const owner = await register(service)
  const response = await service.demo({ ...owner, type: 'service', zone: 'centro' })
  assert.equal(response.status, 200)
  assert.equal(response.body.accepted, true)
  assert.ok((await store.get(owner.id)).delivered['service:centro'])
})

test('a storage failure after provider acceptance never asks for an immediate resend', async () => {
  const store = createMemoryPushStore()
  const service = createPushService({ store: { ...store, finalize: async () => { throw new Error('storage unavailable') } }, send: async () => {} })
  const owner = await register(service)
  const response = await service.demo({ ...owner, type: 'service', zone: 'centro' })
  assert.equal(response.status, 200)
  assert.equal(response.body.accepted, true)
  assert.equal(response.body.persistent, false)
  assert.match(response.body.message, /No repitas/)
})

test('local daily suppression survives a post-acceptance disk failure after the lease expires', async () => {
  let writes = 0, time = Date.parse('2026-10-29T15:00:00Z'), sent = 0
  const store = createMemoryPushStore({ persist: () => { if (++writes === 4) throw new Error('disk unavailable') } })
  const service = createPushService({ store, now: () => time, send: async () => { sent++ } })
  const owner = (await service.register({ subscription, preferences: { ...preferences, frequency: 'daily' } })).body
  const first = await service.demo({ ...owner, type: 'service', zone: 'centro' })
  assert.equal(first.body.accepted, true)
  assert.equal(first.body.persistent, false)
  time += 61_000
  assert.equal((await service.demo({ ...owner, type: 'service', zone: 'centro' })).body.suppressed, true)
  assert.equal(sent, 1)
})

test('cloud configuration fails closed and does not disclose missing secrets', async () => {
  const handler = createVercelPushHandler({ environment: {}, waitUntil: () => {} })
  const result = await handler(new Request('https://sf.example/api/push/config'))
  assert.equal(result.status, 503)
  assert.equal((await result.json()).error, 'Web Push no está configurado en este despliegue. El historial sigue disponible.')
})

test('cloud handler checks the canonical HTTPS origin and schedules work with waitUntil', async () => {
  const { service, sent } = setup(), tasks = []
  const handler = createVercelPushHandler({ origin: 'https://sf.example', publicKey: 'public-test', service, waitUntil: (task) => tasks.push(task), sleep: async () => {}, rateKey: () => 'test' })
  const post = (action, body, origin = 'https://sf.example') => handler(new Request(`https://sf.example/api/push/${action}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  assert.equal((await post('subscriptions', { subscription, preferences }, 'https://evil.example')).status, 403)
  const owner = await (await post('subscriptions', { subscription, preferences })).json()
  const response = await post('demo', { ...owner, type: 'service', zone: 'centro', delaySeconds: 10 })
  assert.equal(response.status, 202)
  assert.equal(tasks.length, 1)
  await Promise.all(tasks)
  assert.equal(sent.length, 1)
  assert.equal((await handler(new Request('https://evil.example/api/push/config'))).status, 403)
})

test('Neon storage parameterizes values, bounds queries and sanitizes driver failures', async () => {
  const calls = []
  const store = createNeonPushStore({ sql: { query: async (...args) => { calls.push(args); return [{ allowed: true }] } } })
  assert.equal(await store.rate('test-ip'), true)
  assert.ok(calls[0][2].fetchOptions.signal instanceof AbortSignal)
  assert.ok(calls[0][1].includes('test-ip'))
  assert.ok(!calls[0][0].includes('test-ip'))
  const failed = createNeonPushStore({ sql: { query: async () => { throw new Error('private connection details') } } })
  await assert.rejects(failed.get('a'.repeat(32)), (error) => error.status === 503 && !error.message.includes('private'))
})
