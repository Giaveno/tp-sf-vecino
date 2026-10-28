import webpush from 'web-push'
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPushServer, validSubscription, validPreferences } from './push-server.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), privateDir = resolve(root, '.local')
mkdirSync(privateDir, { recursive: true, mode: 0o700 })
const keyPath = resolve(privateDir, 'vapid.json'), recordsPath = resolve(privateDir, 'subscriptions.json')
if (!existsSync(keyPath)) writeFileSync(keyPath, JSON.stringify(webpush.generateVAPIDKeys()), { flag: 'wx', mode: 0o600 })
try { chmodSync(keyPath, 0o600) } catch { /* Windows ACLs inherit from the user's project directory. */ }
const keys = JSON.parse(readFileSync(keyPath, 'utf8'))
webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:demo@example.invalid', keys.publicKey, keys.privateKey)
let records = new Map()
if (existsSync(recordsPath)) {
  try {
    const stored = JSON.parse(readFileSync(recordsPath, 'utf8'))
    if (!Array.isArray(stored) || stored.length > 50 || !stored.every((entry) => Array.isArray(entry) && /^[a-f0-9]{32}$/.test(entry[0]) && validSubscription(entry[1]?.subscription) && validPreferences(entry[1]?.preferences) && /^[a-f0-9]{64}$/.test(entry[1]?.token))) throw new Error('Invalid records')
    records = new Map(stored)
  }
  catch { throw new Error('El archivo local de suscripciones está dañado. Conservá una copia y retiralo antes de reiniciar; luego reactivá push.') }
}
function persist() {
  const temporary = `${recordsPath}.tmp`
  writeFileSync(temporary, JSON.stringify([...records]), { mode: 0o600 }); renameSync(temporary, recordsPath)
}
const server = createPushServer({ records, publicKey: keys.publicKey, persist, send: (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 60, timeout: 5000 }), dist: resolve(root, 'dist') })
const port = Number(process.env.PORT ?? 4175)
server.on('error', (error) => { console.error(`No se pudo iniciar el servidor local (${error.code ?? 'error'}). Elegí otro PORT si está ocupado.`); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => console.log(`SF Vecino disponible en http://localhost:${port} · emisor push de demostración local`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
