import { neon } from '@neondatabase/serverless'

const idPattern = /^[a-f0-9]{32}$/
const unavailable = () => Object.assign(new Error('El almacenamiento push no está disponible. Volvé a intentar.'), { status: 503 })

export function createNeonPushStore({ databaseUrl, sql: injectedSql, namespace = 'sf-vecino:v1', maxRecords = 500, timeoutMs = 8000 } = {}) {
  if (!/^[a-zA-Z0-9:_-]{1,80}$/.test(namespace) || !Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 500) throw new Error('Invalid push storage configuration')
  let sql = injectedSql
  if (!sql) {
    try {
      const url = new URL(databaseUrl)
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.password || !url.hostname.endsWith('.neon.tech')) throw new Error('Invalid database configuration')
      sql = neon(databaseUrl)
    } catch { throw unavailable() }
  }
  const execute = async (operation) => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs)
    try { return await operation({ fetchOptions: { signal: controller.signal } }) }
    catch { throw unavailable() }
    finally { clearTimeout(timer) }
  }
  const query = (text, parameters) => execute((options) => sql.query(text, parameters, options))
  const lockQuery = () => sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`tp5_push:${namespace}`])
  return {
    async get(id) {
      if (!idPattern.test(id ?? '')) return null
      const rows = await query('SELECT data FROM tp5_push.subscriptions WHERE namespace = $1 AND id = $2 AND expires_at > now()', [namespace, id])
      return rows[0]?.data ?? null
    },
    async lookup(endpointHash) {
      const rows = await query('SELECT id FROM tp5_push.subscriptions WHERE namespace = $1 AND endpoint_hash = $2 AND expires_at > now()', [namespace, endpointHash])
      return rows[0]?.id ?? null
    },
    async commit(id, expectedVersion, record) {
      const values = [namespace, id, record.endpointHash, record.version, JSON.stringify(record), new Date(record.expiresAt).toISOString()]
      if (expectedVersion > 0) {
        const rows = await query('UPDATE tp5_push.subscriptions SET version = $4, data = $5::jsonb, expires_at = $6::timestamptz WHERE namespace = $1 AND id = $2 AND endpoint_hash = $3 AND version = $7 AND expires_at > now() RETURNING id', [...values, expectedVersion])
        return rows.length === 1
      }
      // The advisory lock is a separate statement: READ COMMITTED takes a fresh
      // snapshot for the conditional insert after a competing writer commits.
      const rows = await execute((options) => sql.transaction([
        lockQuery(),
        sql.query('DELETE FROM tp5_push.subscriptions WHERE namespace = $1 AND expires_at <= now()', [namespace]),
        sql.query('WITH inserted AS (INSERT INTO tp5_push.subscriptions (namespace, id, endpoint_hash, version, data, expires_at) SELECT $1, $2, $3, $4, $5::jsonb, $6::timestamptz WHERE (SELECT count(*) FROM tp5_push.subscriptions WHERE namespace = $1) < $7 ON CONFLICT DO NOTHING RETURNING id) SELECT EXISTS (SELECT 1 FROM inserted) AS inserted, (SELECT count(*) FROM tp5_push.subscriptions WHERE namespace = $1) >= $7 AS full', [...values, maxRecords]),
      ], { ...options, isolationLevel: 'ReadCommitted' }))
      if (!rows[2][0].inserted && rows[2][0].full) throw Object.assign(new Error('Se alcanzó el límite de suscripciones del prototipo.'), { status: 429 })
      return rows[2][0].inserted
    },
    async remove(id, expectedVersion) {
      const rows = await execute((options) => sql.transaction([
        lockQuery(),
        sql.query('DELETE FROM tp5_push.subscriptions WHERE namespace = $1 AND id = $2 AND version = $3 RETURNING id', [namespace, id, expectedVersion]),
      ], { ...options, isolationLevel: 'ReadCommitted' }))
      return rows[1].length === 1
    },
    async finalize(id, jobId, status, day) {
      if (status === 410) {
        const rows = await execute((options) => sql.transaction([
          lockQuery(),
          sql.query("DELETE FROM tp5_push.subscriptions WHERE namespace = $1 AND id = $2 AND data #>> '{pending,id}' = $3 RETURNING id", [namespace, id, jobId]),
        ], { ...options, isolationLevel: 'ReadCommitted' }))
        return rows[1].length === 1
      }
      const rows = await query("UPDATE tp5_push.subscriptions SET version = version + 1, data = jsonb_set(CASE WHEN $4::integer = 200 THEN jsonb_set(data - 'pending', '{delivered}', COALESCE(data -> 'delivered', '{}'::jsonb) || jsonb_build_object((data #>> '{pending,type}') || ':' || (data #>> '{pending,zone}'), $5::text)) ELSE data - 'pending' END, '{version}', to_jsonb(version + 1)) WHERE namespace = $1 AND id = $2 AND data #>> '{pending,id}' = $3 AND expires_at > now() RETURNING id", [namespace, id, jobId, status, day])
      return rows.length === 1
    },
    async rate(scope, now = Date.now()) {
      const rows = await query('WITH expired AS (DELETE FROM tp5_push.rate_limits WHERE namespace = $1 AND expires_at <= now()) INSERT INTO tp5_push.rate_limits (namespace, scope, bucket, attempts, expires_at) VALUES ($1, $2, $3, 1, $4::timestamptz) ON CONFLICT (namespace, scope) DO UPDATE SET bucket = EXCLUDED.bucket, attempts = CASE WHEN tp5_push.rate_limits.bucket = EXCLUDED.bucket THEN tp5_push.rate_limits.attempts + 1 ELSE 1 END, expires_at = EXCLUDED.expires_at RETURNING attempts <= 30 AS allowed', [namespace, scope, Math.floor(now / 60_000), new Date(now + 120_000).toISOString()])
      return rows[0]?.allowed === true
    },
  }
}
