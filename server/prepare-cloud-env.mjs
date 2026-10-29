import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import webpush from 'web-push'

// Values are written only to the ignored local environment file, never stdout.
try {
  const path = resolve('.env.local')
  const current = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const has = (name) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`, 'm').test(current)
  if (!has('DATABASE_URL')) throw new Error('Database configuration missing')
  const lines = []
  if (has('VAPID_PUBLIC_KEY') !== has('VAPID_PRIVATE_KEY')) throw new Error('Partial key configuration')
  if (!has('VAPID_PUBLIC_KEY')) {
    const keys = webpush.generateVAPIDKeys()
    lines.push(`VAPID_PUBLIC_KEY=${keys.publicKey}`, `VAPID_PRIVATE_KEY=${keys.privateKey}`)
  }
  if (!has('VAPID_SUBJECT')) lines.push('VAPID_SUBJECT=https://github.com/Giaveno/tp-sf-vecino')
  if (!has('APP_ORIGIN')) lines.push('APP_ORIGIN=https://replace-with-project.vercel.app')
  if (lines.length) appendFileSync(path, `\n${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 })
  console.log('Cloud environment names are prepared in ignored .env.local. Replace APP_ORIGIN with the actual HTTPS domain. No values were printed.')
} catch {
  console.error('Cloud environment preparation failed. Keep DATABASE_URL and any existing key pair; check for incomplete configuration. No values were printed.')
  process.exitCode = 1
}
