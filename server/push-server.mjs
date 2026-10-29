import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, sep, extname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createMemoryPushStore } from './push-store.mjs'
import { createPushService } from './push-service.mjs'
import { settleScheduledPush } from './push-policy.mjs'
export { validPreferences, validSubscription, settleScheduledPush } from './push-policy.mjs'
function acceptsGzip(header = '') {
  return header.split(',').some((value) => {
    const [encoding, ...parameters] = value.trim().toLowerCase().split(';').map((part) => part.trim())
    const quality = parameters.find((part) => part.startsWith('q='))
    return encoding === 'gzip' && (!quality || (Number(quality.slice(2)) > 0 && Number(quality.slice(2)) <= 1))
  })
}
async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) throw Object.assign(new Error('JSON requerido.'), { status: 415 })
  let body = ''
  for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 16_384) throw Object.assign(new Error('Solicitud demasiado grande.'), { status: 413 }) }
  try {
    const value = JSON.parse(body)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object')
    return value
  } catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }) }
}
export function createPushServer({ records = new Map(), publicKey, persist = () => {}, send, dist = resolve('dist') }) {
  const service = createPushService({ store: createMemoryPushStore({ records, persist }), send })
  const actions = { subscriptions: 'register', preferences: 'preferences', demo: 'demo', unsubscribe: 'unsubscribe' }
  const pending = new Map()
  const compressedAssets = new Map()
  const reply = (response, status, body) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(body)) }
  const server = createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? ''
      if (!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host)) return reply(response, 403, { error: 'Este emisor es una demostración local.' })
      const url = new URL(request.url, `http://${host}`)
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/push/config' && request.method === 'GET') return reply(response, 200, { publicKey })
        if (request.method !== 'POST') return reply(response, 405, { error: 'Método no permitido.' })
        if (request.headers.origin !== `http://${host}`) return reply(response, 403, { error: 'Origen no permitido.' })
        const action = /^\/api\/push\/([a-z]+)$/.exec(url.pathname)?.[1]
        if (!actions[action]) return reply(response, 404, { error: 'Ruta no encontrada.' })
        const body = await readJson(request), result = await service[actions[action]](body)
        if (action === 'unsubscribe' && result.body.removed) { clearTimeout(pending.get(body.id)); pending.delete(body.id) }
        if (result.job) {
          pending.set(body.id, setTimeout(() => {
            pending.delete(body.id)
            void settleScheduledPush(result.job.run, (status) => console.info(`[push ${result.job.id}] resultado ${status}; no confirma recepción en el dispositivo`))
          }, result.job.delayMs))
        }
        return reply(response, result.status, result.body)
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
