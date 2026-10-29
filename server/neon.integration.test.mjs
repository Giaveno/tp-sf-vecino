import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { createNeonPushStore } from './neon-store.mjs'
import { createPushService } from './push-service.mjs'

test('real Neon: atomic ownership, CAS, capacity, quota, delayed revocation and preference updates', { skip: !process.env.DATABASE_URL, timeout: 90_000 }, async (t) => {
  const namespace = `test_${randomBytes(12).toString('hex')}`
  const sql = neon(process.env.DATABASE_URL)
  const store = createNeonPushStore({ sql, namespace, maxRecords: 3 })
  const other = createNeonPushStore({ sql, namespace, maxRecords: 3 })
  const preferences = { types: ['service'], zones: ['centro'], frequency: 'immediate' }
  const subscription = (suffix) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${namespace}-${suffix}`, keys: { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } })
  const ids = new Set(), scopes = new Set()
  const sent = []
  const service = createPushService({ store, send: async (...args) => sent.push(args) })
  const second = createPushService({ store: other, send: async (...args) => sent.push(args) })
  let owner
  try {
    await t.test('same endpoint has a single owner across concurrent function instances', async () => {
      const body = { subscription: subscription('same'), preferences }
      const responses = await Promise.all([service.register(body), second.register(body)])
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 403])
      owner = responses.find((r) => r.status === 201).body
      ids.add(owner.id)
      assert.equal((await second.register({ ...body, ...owner, token: '0'.repeat(64) })).status, 403)
      assert.equal((await second.register({ ...body, ...owner })).status, 201)
    })
    await t.test('compare-and-swap prevents stale writes and two simultaneous send reservations', async () => {
      const original = await store.get(owner.id)
      assert.equal(await store.commit(owner.id, original.version, { ...original, version: original.version + 1 }), true)
      assert.equal(await other.commit(owner.id, original.version, { ...original, version: original.version + 1 }), false)
      const jobs = await Promise.all([service.demo({ ...owner, type: 'service', zone: 'centro', delaySeconds: 10 }), second.demo({ ...owner, type: 'service', zone: 'centro', delaySeconds: 10 })])
      assert.deepEqual(jobs.map((r) => r.status).sort(), [202, 429])
      const scheduled = jobs.find((r) => r.status === 202)
      await second.preferences({ ...owner, preferences: { ...preferences, frequency: 'paused' } })
      assert.equal((await scheduled.job.run()).body.suppressed, true)
      assert.equal(sent.length, 0)
    })
    await t.test('capacity is enforced under the shared lock and reports 429', async () => {
      const responses = await Promise.all(['a', 'b', 'c'].map((suffix) => service.register({ subscription: subscription(suffix), preferences })))
      for (const response of responses) if (response.status === 201) ids.add(response.body.id)
      assert.equal(responses.filter((r) => r.status === 201).length, 2)
      assert.equal(responses.filter((r) => r.status === 429).length, 1)
    })
    await t.test('rate limits use one atomic counter across independent store instances', async () => {
      const scope = `${namespace}:quota`; scopes.add(scope)
      const results = await Promise.all(Array.from({ length: 35 }, (_, i) => (i % 2 ? store : other).rate(scope)))
      assert.equal(results.filter(Boolean).length, 30)
      await sql.query("UPDATE tp5_push.rate_limits SET expires_at = now() - interval '1 second' WHERE namespace = $1 AND scope = $2", [namespace, scope])
      assert.equal(await store.rate(scope, Date.now() + 60_000), true)
    })
    await t.test('revoking a scheduled subscription prevents delivery and never resurrects it', async () => {
      // Refresh the saved record timestamp through a CAS, without waiting ten seconds.
      const record = await store.get(owner.id)
      await store.commit(owner.id, record.version, { ...record, version: record.version + 1, lastAttemptAt: 0, preferences })
      const scheduled = await service.demo({ ...owner, type: 'service', zone: 'centro', delaySeconds: 10 })
      assert.equal(scheduled.status, 202)
      assert.equal((await second.unsubscribe(owner)).status, 200)
      assert.equal((await scheduled.job.run()).status, 404)
      assert.equal(await store.get(owner.id), null)
      assert.equal(sent.length, 0)
    })
    await t.test('provider acceptance preserves concurrent preferences and the durable daily marker', async () => {
      const fixedTime = Date.now()
      let credential
      const accepting = createPushService({ store, now: () => fixedTime, send: async () => {
        await second.preferences({ ...credential, preferences: { ...preferences, frequency: 'paused' } })
        await second.preferences({ ...credential, preferences: { ...preferences, frequency: 'daily' } })
      } })
      credential = (await accepting.register({ subscription: subscription('accepted'), preferences })).body
      ids.add(credential.id)
      const response = await accepting.demo({ ...credential, type: 'service', zone: 'centro' })
      assert.equal(response.status, 200)
      assert.equal(response.body.accepted, true)
      const saved = await store.get(credential.id)
      assert.equal(saved.preferences.frequency, 'daily')
      assert.equal(saved.pending, undefined)
      assert.equal(typeof saved.delivered['service:centro'], 'string')
      assert.equal((await accepting.demo({ ...credential, type: 'service', zone: 'centro' })).body.suppressed, true)
    })
  } finally {
    // Cleanup only exact random IDs/scopes owned by this test, never application rows.
    const remaining = await sql.query('SELECT id FROM tp5_push.subscriptions WHERE namespace = $1', [namespace], { fetchOptions: { signal: AbortSignal.timeout(10_000) } })
    for (const row of remaining) ids.add(row.id)
    await sql.transaction([
      sql.query('DELETE FROM tp5_push.subscriptions WHERE namespace = $1 AND id = ANY($2::text[])', [namespace, [...ids]]),
      sql.query('DELETE FROM tp5_push.rate_limits WHERE namespace = $1 AND scope = ANY($2::text[])', [namespace, [...scopes]]),
    ], { fetchOptions: { signal: AbortSignal.timeout(10_000) } })
  }
})
