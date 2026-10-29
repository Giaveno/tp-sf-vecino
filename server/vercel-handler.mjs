import { createECDH, createHmac } from 'node:crypto'
import webpush from 'web-push'
import { createPushService } from './push-service.mjs'
import { createNeonPushStore } from './neon-store.mjs'
import { settleScheduledPush } from './push-policy.mjs'

const configurationMessage = 'Web Push no está configurado en este despliegue. El historial sigue disponible.'
const response = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
const actions = { subscriptions: 'register', preferences: 'preferences', demo: 'demo', unsubscribe: 'unsubscribe' }
function cloudConfiguration(environment) {
  try {
    const origin = new URL(environment.APP_ORIGIN)
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null
    const publicKey = environment.VAPID_PUBLIC_KEY, privateKey = environment.VAPID_PRIVATE_KEY, subject = environment.VAPID_SUBJECT
    if (!/^[\w-]+={0,2}$/.test(publicKey ?? '') || !/^[\w-]+={0,2}$/.test(privateKey ?? '') || !/^mailto:[^\s@]+@[^\s@]+$|^https:\/\/[^\s]+$/.test(subject ?? '')) return null
    const privateBytes = Buffer.from(privateKey, 'base64url'), publicBytes = Buffer.from(publicKey, 'base64url')
    if (privateBytes.length !== 32 || publicBytes.length !== 65 || !createECDH('prime256v1').setPrivateKey(privateBytes).getPublicKey().equals(publicBytes)) return null
    if (!environment.DATABASE_URL) return null
    return { origin: origin.origin, publicKey, privateKey, subject }
  } catch { return null }
}
async function jsonBody(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) throw Object.assign(new Error('JSON requerido.'), { status: 415 })
  const reader = request.body?.getReader()
  if (!reader) throw Object.assign(new Error('Solicitud inválida.'), { status: 400 })
  const chunks = []; let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > 16_384) { await reader.cancel(); throw Object.assign(new Error('Solicitud demasiado grande.'), { status: 413 }) }
      chunks.push(Buffer.from(value))
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid object')
    return body
  } catch (error) { if (error.status) throw error; throw Object.assign(new Error('JSON inválido.'), { status: 400 }) }
}

// All secrets and database dependencies stay in this server-only module.
export function createVercelPushHandler({ environment = process.env, origin: injectedOrigin, publicKey: injectedKey, service: injectedService, waitUntil, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), rateKey } = {}) {
  const config = injectedService ? { origin: injectedOrigin, publicKey: injectedKey } : cloudConfiguration(environment)
  let service = injectedService
  if (config && !service) {
    try {
      service = createPushService({
        store: createNeonPushStore({ databaseUrl: environment.DATABASE_URL, namespace: environment.PUSH_NAMESPACE ?? 'sf-vecino:v1' }),
        send: (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 60, timeout: 5000, vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey } }),
      })
    } catch { service = null }
  }
  return async (request) => {
    if (!config || !service) return response(503, { error: configurationMessage })
    try {
      const url = new URL(request.url)
      if (url.origin !== config.origin) return response(403, { error: 'Origen no permitido.' })
      const match = /^\/api\/push\/([a-z]+)$/.exec(url.pathname)
      if (!match || (match[1] !== 'config' && !actions[match[1]])) return response(404, { error: 'Ruta no encontrada.' })
      if (match[1] === 'config' && request.method === 'GET') return response(200, { publicKey: config.publicKey })
      if (request.method !== 'POST' || match[1] === 'config') return response(405, { error: 'Método no permitido.' })
      if (request.headers.get('origin') !== config.origin) return response(403, { error: 'Origen no permitido.' })
      const scope = rateKey ? rateKey(request) : createHmac('sha256', config.privateKey).update('anonymous').digest('hex')
      if (!(await service.rate(scope))) return response(429, { error: 'Demasiadas solicitudes. Esperá un minuto y volvé a intentar.' })
      const body = await jsonBody(request)
      const result = await service[actions[match[1]]](body)
      if (result.job) {
        if (typeof waitUntil !== 'function') return response(503, { error: 'El emisor no admite envíos diferidos en este entorno.' })
        waitUntil((async () => {
          await sleep(result.job.delayMs)
          await settleScheduledPush(result.job.run, (status) => console.info(`[push ${result.job.id}] resultado ${status}; no confirma recepción en el dispositivo`))
        })())
      }
      return response(result.status, result.body)
    } catch (error) {
      const status = [400, 413, 415, 429, 503].includes(error.status) ? error.status : 503
      return response(status, { error: status === 503 ? 'El emisor push no está disponible. Reintentá más tarde; el historial sigue disponible.' : error.message })
    }
  }
}
