import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { createPushServer, settleScheduledPush, validSubscription } from './push-server.mjs'

const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/demo', keys: { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } }
const preferences = { types: ['service'], zones: ['centro'], frequency: 'immediate' }
test('subscription validation rejects arbitrary hosts, malformed keys and URL credentials', () => {
  assert.equal(validSubscription(subscription), true)
  for (const endpoint of ['https://127.0.0.1/internal', 'http://fcm.googleapis.com/fcm/send/demo', 'https://fcm.googleapis.com.evil.test/demo', 'https://a:b@fcm.googleapis.com/demo']) assert.equal(validSubscription({ ...subscription, endpoint }), false)
  assert.equal(validSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'bad' } }), false)
})
test('a rejected delayed operation is contained and reported without leaking credentials', async () => {
  const reports = []
  await settleScheduledPush(() => Promise.reject(Object.assign(new Error('disk full'), { code: 'ENOSPC' })), (status) => reports.push(status))
  assert.deepEqual(reports, [500])
})
test('failed registration persistence rolls back creation and authorized updates so retries remain possible', async () => {
  const records = new Map(); let failPersistence = true
  const server = createPushServer({ records, publicKey: 'test', persist() { if (failPersistence) throw new Error('disk unavailable') }, send: async () => {} })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const register = (body) => fetch(`${base}/api/push/subscriptions`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  try {
    const failed = await register({ subscription, preferences })
    assert.equal(failed.status, 500)
    assert.deepEqual(await failed.json(), { error: 'No fue posible completar la operación local.' })
    assert.equal(records.size, 0)

    failPersistence = false
    const retried = await register({ subscription, preferences })
    assert.equal(retried.status, 201)
    const account = await retried.json(), saved = records.get(account.id)
    assert.ok(saved); assert.equal(saved.token, account.token)

    const nextSubscription = { ...subscription, keys: { ...subscription.keys, auth: Buffer.alloc(16, 2).toString('base64url') } }
    const nextPreferences = { ...preferences, frequency: 'paused' }
    failPersistence = true
    const failedUpdate = await register({ ...account, subscription: nextSubscription, preferences: nextPreferences })
    assert.equal(failedUpdate.status, 500)
    assert.deepEqual(await failedUpdate.json(), { error: 'No fue posible completar la operación local.' })
    assert.equal(records.get(account.id), saved)
    assert.deepEqual(saved.subscription, subscription)
    assert.deepEqual(saved.preferences, preferences)

    failPersistence = false
    const retryUpdate = await register({ ...account, subscription: nextSubscription, preferences: nextPreferences })
    assert.equal(retryUpdate.status, 201)
    assert.deepEqual(await retryUpdate.json(), account)
    assert.deepEqual(records.get(account.id).subscription, nextSubscription)
    assert.deepEqual(records.get(account.id).preferences, nextPreferences)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
test('same-origin subscription lifecycle, preferences, authorization and expired-provider cleanup', async () => {
  const records = new Map(), calls = []
  const server = createPushServer({ records, publicKey: 'test', persist() {}, send: async (...args) => { calls.push(args); if (calls.length === 2) throw Object.assign(new Error('gone'), { statusCode: 410 }) } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = (path, body, origin = base) => fetch(`${base}${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  try {
    assert.equal((await request('/api/push/subscriptions', { subscription, preferences }, 'https://evil.test')).status, 403)
    const response = await request('/api/push/subscriptions', { subscription, preferences }); assert.equal(response.status, 201)
    const account = await response.json(); assert.ok(account.id); assert.ok(account.token)
    assert.equal((await request('/api/push/subscriptions', { subscription, preferences })).status, 403)
    assert.equal((await request('/api/push/subscriptions', { subscription, preferences, ...account, token: 'wrong' })).status, 403)
    assert.equal((await request('/api/push/subscriptions', { subscription, preferences, ...account })).status, 201)
    assert.equal((await request('/api/push/demo', { ...account, token: 'wrong' })).status, 403)
    const sent = await request('/api/push/demo', { ...account, type: 'service', zone: 'centro' }); assert.equal(sent.status, 200); assert.equal(calls.length, 1)
    assert.equal((await request('/api/push/preferences', { ...account, preferences: { ...preferences, frequency: 'paused' } })).status, 200)
    const paused = await request('/api/push/demo', { ...account, type: 'service', zone: 'centro' }); assert.equal((await paused.json()).suppressed, true); assert.equal(calls.length, 1)
    await request('/api/push/preferences', { ...account, preferences })
    records.get(account.id).lastAttemptAt = 0
    assert.equal((await request('/api/push/demo', { ...account, type: 'service', zone: 'centro' })).status, 410); assert.equal(records.size, 0)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
test('provider expiry with a disk error stays recoverable and does not stop the application', async () => {
  const records = new Map(); let writes = 0
  const server = createPushServer({ records, publicKey: 'test', persist() { if (++writes === 3) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }) }, send: async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }) } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  try {
    const account = await (await request('/api/push/subscriptions', { subscription, preferences })).json()
    const response = await request('/api/push/demo', { ...account, type: 'service', zone: 'centro' })
    assert.equal(response.status, 410)
    assert.equal(records.size, 0)
    assert.equal((await fetch(`${base}/api/push/config`)).status, 200)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
test('static text responses negotiate gzip while preserving exact content', async () => {
  const temporaryRoot = resolve('tmp'); mkdirSync(temporaryRoot, { recursive: true })
  const dist = mkdtempSync(resolve(temporaryRoot, 'static-test-'))
  const content = '<!doctype html><title>SF Vecino</title>' + '<p>Contenido de prueba</p>'.repeat(200)
  writeFileSync(resolve(dist, 'index.html'), content)
  const server = createPushServer({ publicKey: 'test', send: async () => {}, dist })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { headers: { 'Accept-Encoding': 'gzip' } })
    assert.equal(response.headers.get('content-encoding'), 'gzip')
    assert.equal(response.headers.get('vary'), 'Accept-Encoding')
    assert.equal(await response.text(), content)
    const identity = await fetch(`http://127.0.0.1:${server.address().port}/`, { headers: { 'Accept-Encoding': 'gzip;q=0, identity' } })
    assert.equal(identity.headers.get('content-encoding'), null)
    assert.equal(await identity.text(), content)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (dist.startsWith(`${temporaryRoot}${sep}`)) rmSync(dist, { recursive: true })
  }
})
