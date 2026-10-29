import { createHash, randomBytes } from 'node:crypto'
import { argentinaDay, eligible, TARGETS, tokenMatches, TYPES, validPreferences, validSubscription, ZONES } from './push-policy.mjs'

const result = (status, body) => ({ status, body })
const unauthorized = () => result(403, { error: 'Suscripción no autorizada. Volvé a activar push.' })
const endpointHash = (value) => createHash('sha256').update(value).digest('hex')
const clone = (value) => structuredClone(value)
const maxAttempts = 5

export function createPushService({ store, send, now = Date.now }) {
  const mutate = async (id, change) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const record = await store.get(id)
      const update = change(record)
      if (update.response) return update.response
      if (!record) return unauthorized()
      if (update.remove) {
        if (await store.remove(id, record.version ?? 0, update.allowVolatile)) return update.success
      } else {
        const next = { ...update.record, version: (record.version ?? 0) + 1 }
        if (await store.commit(id, record.version ?? 0, next)) return update.success
      }
    }
    return result(409, { error: 'La suscripción cambió durante la operación. Volvé a intentar.' })
  }
  const finish = async (id, jobId, status) => {
    const persistent = await store.finalize(id, jobId, status, argentinaDay(now()))
    if (status === 410) return result(410, { error: 'La suscripción venció. Desactivá y volvé a activar push.' })
    return status === 200
      ? result(200, { accepted: true, persistent, message: 'El proveedor aceptó el envío; la recepción depende del navegador y sus permisos.' })
      : result(502, { error: 'El proveedor no confirmó el envío. Revisá Internet y volvé a intentar.' })
  }
  const deliver = async (id, jobId) => {
    let ready
    const claim = await mutate(id, (record) => {
      if (!record) return { response: result(404, { error: 'Suscripción no encontrada.' }) }
      if (record.pending?.id !== jobId || record.pending.expiresAt <= now()) return { response: result(409, { error: 'El envío pendiente venció o fue reemplazado.' }) }
      const next = clone(record)
      if (!eligible(record, record.pending.type, record.pending.zone, now())) {
        delete next.pending
        return { record: next, success: result(200, { suppressed: true }) }
      }
      if (record.pending.sending) return { response: result(409, { error: 'El envío ya está en curso.' }) }
      next.pending.sending = true
      ready = clone(next)
      return { record: next, success: result(200, { claimed: true }) }
    })
    if (!claim.body.claimed) return claim
    const event = { id: `push-${randomBytes(12).toString('hex')}`, title: 'Aviso municipal de demostración', detail: 'Notificación Web Push real con contenido municipal simulado.', type: ready.pending.type, zone: ready.pending.zone, target: TARGETS[ready.pending.type], createdAt: new Date(now()).toISOString(), read: false }
    let status = 200
    try { await send(ready.subscription, JSON.stringify(event)) }
    catch (error) { status = [404, 410].includes(error.statusCode) ? 410 : 502 }
    try { return await finish(id, jobId, status) }
    catch {
      console.warn(`Push: resultado ${status}; no fue posible actualizar el estado persistente.`)
      if (status === 410) return result(410, { error: 'La suscripción venció. Desactivá y volvé a activar push.' })
      return status === 200 ? result(200, { accepted: true, persistent: false, message: 'El proveedor aceptó el envío; no se pudo guardar el resultado. No repitas el aviso inmediatamente.' }) : result(502, { error: 'No fue posible completar el envío. Volvé a intentar.' })
    }
  }
  return {
    async register(body) {
      if (!validSubscription(body.subscription) || !validPreferences(body.preferences)) return result(400, { error: 'Suscripción o preferencias inválidas.' })
      const hash = endpointHash(body.subscription.endpoint)
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const id = await store.lookup(hash), previous = id ? await store.get(id) : null
        if (previous && (body.id !== id || !tokenMatches(body.token, previous.token))) return unauthorized()
        const key = previous ? id : randomBytes(16).toString('hex')
        const record = { ...previous, id: key, token: previous?.token ?? randomBytes(32).toString('hex'), endpointHash: hash, subscription: body.subscription, preferences: body.preferences, delivered: previous?.delivered ?? {}, lastAttemptAt: previous?.lastAttemptAt ?? 0, version: (previous?.version ?? 0) + 1, expiresAt: now() + 30 * 24 * 60 * 60_000 }
        try {
          if (await store.commit(key, previous?.version ?? 0, record)) return result(201, { id: key, token: record.token })
        } catch (error) {
          if (error.status === 429) return result(429, { error: error.message })
          throw error
        }
      }
      return result(409, { error: 'La suscripción cambió durante el registro. Volvé a intentar.' })
    },
    preferences(body) {
      if (!validPreferences(body.preferences)) return Promise.resolve(result(400, { error: 'Preferencias inválidas.' }))
      return mutate(body.id, (record) => !record || !tokenMatches(body.token, record.token) ? { response: unauthorized() } : { record: { ...record, preferences: body.preferences }, success: result(200, { updated: true }) })
    },
    unsubscribe(body) {
      return mutate(body.id, (record) => !record || !tokenMatches(body.token, record.token) ? { response: unauthorized() } : { remove: true, success: result(200, { removed: true }) })
    },
    async demo(body) {
      const type = body.type ?? 'service', zone = body.zone ?? 'all', delay = body.delaySeconds ?? 0
      if (!TYPES.includes(type) || !ZONES.includes(zone) || !Number.isInteger(delay) || delay < 0 || delay > 30) return result(400, { error: 'Evento inválido.' })
      const jobId = randomBytes(12).toString('hex')
      const reserved = await mutate(body.id, (record) => {
        if (!record || !tokenMatches(body.token, record.token)) return { response: unauthorized() }
        if (!eligible(record, type, zone, now())) return { response: result(200, { suppressed: true }) }
        if ((record.pending && record.pending.expiresAt > now()) || now() - record.lastAttemptAt < 10_000) return { response: result(429, { error: 'Esperá diez segundos antes de otro envío.' }) }
        return { record: { ...record, lastAttemptAt: now(), pending: { id: jobId, type, zone, expiresAt: now() + 60_000 } }, success: result(200, { reserved: true }) }
      })
      if (!reserved.body.reserved) return reserved
      if (delay) return { status: 202, body: { scheduled: true, delaySeconds: delay, jobId }, job: { id: jobId, delayMs: delay * 1000, run: () => deliver(body.id, jobId) } }
      return deliver(body.id, jobId)
    },
    rate: (scope) => store.rate(scope, now()),
  }
}
