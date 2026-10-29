import { createHash } from 'node:crypto'

const clone = (value) => value ? structuredClone(value) : null
const hashOf = (record) => record.endpointHash ?? createHash('sha256').update(record.subscription.endpoint).digest('hex')

// The local adapter serializes mutations and rolls back failed persistence.
// Cloud workers use the same versioned contract implemented in PostgreSQL.
export function createMemoryPushStore({ records = new Map(), persist = () => {}, maxRecords = 50 } = {}) {
  let queue = Promise.resolve()
  const rates = new Map()
  const locked = (operation) => {
    const result = queue.then(operation)
    queue = result.catch(() => {})
    return result
  }
  return {
    async get(id) { await queue; return clone(records.get(id)) },
    async lookup(endpointHash) { await queue; return [...records].find(([, value]) => hashOf(value) === endpointHash)?.[0] ?? null },
    commit(id, expectedVersion, record) {
      return locked(async () => {
        const previous = records.get(id)
        if ((previous?.version ?? 0) !== expectedVersion || (!previous && expectedVersion !== 0)) return false
        if ([...records].some(([otherId, value]) => otherId !== id && hashOf(value) === record.endpointHash)) return false
        if (!previous && records.size >= maxRecords) throw Object.assign(new Error('Subscription limit'), { status: 429 })
        records.set(id, clone(record))
        try { await persist() }
        catch (error) { if (previous) records.set(id, previous); else records.delete(id); throw error }
        return true
      })
    },
    remove(id, expectedVersion, allowVolatile = false) {
      return locked(async () => {
        const previous = records.get(id)
        if (!previous || (previous.version ?? 0) !== expectedVersion) return false
        records.delete(id)
        try { await persist() }
        catch (error) { if (!allowVolatile) { records.set(id, previous); throw error } }
        return true
      })
    },
    finalize(id, jobId, status, day) {
      return locked(async () => {
        const previous = records.get(id)
        if (previous?.pending?.id !== jobId) return false
        if (status === 410) records.delete(id)
        else {
          const next = clone(previous)
          if (status === 200) next.delivered[`${next.pending.type}:${next.pending.zone}`] = day
          delete next.pending
          next.version = (previous.version ?? 0) + 1
          records.set(id, next)
        }
        // Provider acceptance cannot be rolled back. Keep the daily marker in
        // RAM even if the file write fails; the service reports degraded durability.
        await persist()
        return true
      })
    },
    async rate(scope, now = Date.now()) {
      const cutoff = Math.floor(now / 60_000)
      const current = rates.get(scope)
      const value = current?.window === cutoff ? current : { window: cutoff, count: 0 }
      value.count++; rates.set(scope, value)
      if (rates.size > 500) for (const [key, entry] of rates) if (entry.window !== cutoff) rates.delete(key)
      return value.count <= 30
    },
  }
}
