import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, sep, extname } from 'node:path'
import { gzipSync } from 'node:zlib'

const TYPES = ['service', 'tax', 'claim', 'alarm', 'parking']
const ZONES = ['all', 'centro', 'terminal', 'plaza']
const targets = { service: 'contacts', tax: 'taxes', claim: 'claims', alarm: 'alarms', parking: 'parking' }
export const validPreferences = (p) => p && Array.isArray(p.types) && p.types.length <= 5 && p.types.every((t) => TYPES.includes(t)) && Array.isArray(p.zones) && p.zones.length <= 3 && p.zones.every((z) => ZONES.includes(z) && z !== 'all') && ['immediate', 'daily', 'paused'].includes(p.frequency)
export function validSubscription(value) {
  try {
    const url = new URL(value.endpoint)
    const host = url.hostname
    const trusted = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') || host === 'web.push.apple.com'
    const key = value.keys?.p256dh, auth = value.keys?.auth
    return value.endpoint.length < 4096 && trusted && url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && typeof key === 'string' && /^[\w-]+={0,2}$/.test(key) && Buffer.from(key, 'base64url').length === 65 && typeof auth === 'string' && /^[\w-]+={0,2}$/.test(auth) && Buffer.from(auth, 'base64url').length === 16
  } catch { return false }
}
const day = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(date))
function acceptsGzip(header = '') {
  return header.split(',').some((value) => {
    const [encoding, ...parameters] = value.trim().toLowerCase().split(';').map((part) => part.trim())
    const quality = parameters.find((part) => part.startsWith('q='))
    return encoding === 'gzip' && (!quality || (Number(quality.slice(2)) > 0 && Number(quality.slice(2)) <= 1))
  })
}
export async function settleScheduledPush(operation, report) {
  try { report((await operation()).status) }
  catch { report(500) }
}
function eligible(record, type, zone, now) {
  const p = record.preferences
  return p.frequency !== 'paused' && p.types.includes(type) && (zone === 'all' || p.zones.includes(zone)) && (p.frequency !== 'daily' || record.delivered?.[`${type}:${zone}`] !== day(now))
}
function tokenMatches(actual, expected) {
  return typeof actual === 'string' && /^[a-f0-9]{64}$/.test(actual) && actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}
async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) throw Object.assign(new Error('JSON requerido.'), { status: 415 })
  let body = ''
  for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 16_384) throw Object.assign(new Error('Solicitud demasiado grande.'), { status: 413 }) }
  try { return JSON.parse(body) } catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }) }
}
export function createPushServer({ records = new Map(), publicKey, persist = () => {}, send, dist = resolve('dist') }) {
  const pending = new Map()
  const compressedAssets = new Map()
  const reply = (response, status, body) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(body)) }
  const deliver = async (id, type, zone) => {
    const account = records.get(id)
    if (!account) return { status: 404, body: { error: 'Suscripción no encontrada.' } }
    if (!eligible(account, type, zone, Date.now())) return { status: 200, body: { suppressed: true } }
    const event = { id: `push-${randomBytes(12).toString('hex')}`, title: 'Aviso municipal de demostración', detail: 'Notificación Web Push real con contenido municipal simulado.', type, zone, target: targets[type], createdAt: new Date().toISOString(), read: false }
    try {
      await send(account.subscription, JSON.stringify(event))
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) { records.delete(id); try { persist() } catch { console.warn('Push: no se pudo persistir la baja de una suscripción vencida.') } return { status: 410, body: { error: 'La suscripción venció. Desactivá y volvé a activar push.' } } }
      return { status: 502, body: { error: 'El proveedor no confirmó el envío. Revisá Internet y volvé a intentar.' } }
    }
    account.delivered ??= {}; account.delivered[`${type}:${zone}`] = day(Date.now())
    let persistent = true
    try { persist() } catch { persistent = false; console.warn('Push: envío aceptado; no se pudo persistir el límite diario.') }
    return { status: 200, body: { accepted: true, persistent, message: 'El proveedor aceptó el envío; la recepción depende del navegador y sus permisos.' } }
  }
  const server = createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? ''
      if (!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host)) return reply(response, 403, { error: 'Este emisor es una demostración local.' })
      const url = new URL(request.url, `http://${host}`)
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/push/config' && request.method === 'GET') return reply(response, 200, { publicKey })
        if (request.method !== 'POST') return reply(response, 405, { error: 'Método no permitido.' })
        if (request.headers.origin !== `http://${host}`) return reply(response, 403, { error: 'Origen no permitido.' })
        const body = await readJson(request)
        if (url.pathname === '/api/push/subscriptions') {
          if (!validSubscription(body.subscription) || !validPreferences(body.preferences)) return reply(response, 400, { error: 'Suscripción o preferencias inválidas.' })
          let entry = [...records].find(([, account]) => account.subscription.endpoint === body.subscription.endpoint)
          const previous = entry?.[1]
          if (!entry) {
            if (records.size >= 50) return reply(response, 429, { error: 'Se alcanzó el límite local de suscripciones.' })
            const id = randomBytes(16).toString('hex'), token = randomBytes(32).toString('hex')
            entry = [id, { subscription: body.subscription, preferences: body.preferences, token, delivered: {}, lastAttemptAt: 0 }]
          } else {
            if (body.id !== entry[0] || !tokenMatches(body.token, entry[1].token)) return reply(response, 403, { error: 'Esta suscripción ya tiene un propietario. Desactivá push en este navegador y volvé a activarlo.' })
            entry = [entry[0], { ...previous, subscription: body.subscription, preferences: body.preferences }]
          }
          records.set(...entry)
          try { persist() }
          catch (error) {
            if (previous) records.set(entry[0], previous)
            else records.delete(entry[0])
            throw error
          }
          return reply(response, 201, { id: entry[0], token: entry[1].token })
        }
        const account = records.get(body.id)
        if (!account || !tokenMatches(body.token, account.token)) return reply(response, 403, { error: 'Suscripción no autorizada. Volvé a activar push.' })
        if (url.pathname === '/api/push/unsubscribe') {
          records.delete(body.id); clearTimeout(pending.get(body.id)); pending.delete(body.id); persist(); return reply(response, 200, { removed: true })
        }
        if (url.pathname === '/api/push/preferences') {
          if (!validPreferences(body.preferences)) return reply(response, 400, { error: 'Preferencias inválidas.' })
          account.preferences = body.preferences; persist(); return reply(response, 200, { updated: true })
        }
        if (url.pathname === '/api/push/demo') {
          const type = body.type ?? 'service', zone = body.zone ?? 'all', delay = body.delaySeconds ?? 0
          if (!TYPES.includes(type) || !ZONES.includes(zone) || !Number.isInteger(delay) || delay < 0 || delay > 30) return reply(response, 400, { error: 'Evento inválido.' })
          if (!eligible(account, type, zone, Date.now())) return reply(response, 200, { suppressed: true })
          if (pending.has(body.id) || Date.now() - account.lastAttemptAt < 10_000) return reply(response, 429, { error: 'Esperá diez segundos antes de otro envío.' })
          account.lastAttemptAt = Date.now(); persist()
          if (delay) {
            const jobId = randomBytes(4).toString('hex')
            pending.set(body.id, setTimeout(() => {
              pending.delete(body.id)
              void settleScheduledPush(() => deliver(body.id, type, zone), (status) => console.info(`[push ${jobId}] resultado ${status}; ${status >= 400 ? 'revisá el emisor y volvé a intentar desde la app' : 'no implica recepción confirmada en el dispositivo'}`))
            }, delay * 1000))
            return reply(response, 202, { scheduled: true, delaySeconds: delay, jobId })
          }
          const result = await deliver(body.id, type, zone); return reply(response, result.status, result.body)
        }
        return reply(response, 404, { error: 'Ruta no encontrada.' })
      }
      if (!['GET', 'HEAD'].includes(request.method)) return reply(response, 405, { error: 'Método no permitido.' })
      let path = resolve(dist, `.${decodeURIComponent(url.pathname)}`)
      if (!path.startsWith(`${dist}${sep}`) && path !== dist) return reply(response, 403, { error: 'Ruta no permitida.' })
      if (path === dist || (!extname(path) && !existsSync(path))) path = resolve(dist, 'index.html')
      if (!existsSync(path) || !statSync(path).isFile()) return reply(response, 404, { error: 'Archivo no encontrado. Ejecutá el build.' })
      const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' }
      const headers = { 'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', Vary: 'Accept-Encoding' }
      let content = readFileSync(path)
      if (acceptsGzip(request.headers['accept-encoding']) && ['.html', '.js', '.css', '.json', '.webmanifest'].includes(extname(path)) && content.length >= 512 && content.length <= 2_000_000) {
        const modified = statSync(path).mtimeMs, cached = compressedAssets.get(path)
        if (cached?.modified === modified) content = cached.content
        else {
          content = gzipSync(content)
          if (compressedAssets.size >= 30) compressedAssets.clear()
          compressedAssets.set(path, { modified, content })
        }
        headers['Content-Encoding'] = 'gzip'
      }
      headers['Content-Length'] = content.length
      response.writeHead(200, headers)
      response.end(request.method === 'HEAD' ? undefined : content)
    } catch (error) { if (!response.headersSent) reply(response, error.status ?? 500, { error: error.status ? error.message : 'No fue posible completar la operación local.' }); else response.end() }
  })
  server.on('close', () => { pending.forEach(clearTimeout); pending.clear() })
  server.requestTimeout = 10_000; server.headersTimeout = 10_000
  return server
}
