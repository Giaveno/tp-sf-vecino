import { timingSafeEqual } from 'node:crypto'

export const TYPES = ['service', 'tax', 'claim', 'alarm', 'parking']
export const ZONES = ['all', 'centro', 'terminal', 'plaza']
export const TARGETS = { service: 'contacts', tax: 'taxes', claim: 'claims', alarm: 'alarms', parking: 'parking' }
export const validPreferences = (p) => p && Array.isArray(p.types) && p.types.length <= 5 && p.types.every((t) => TYPES.includes(t)) && Array.isArray(p.zones) && p.zones.length <= 3 && p.zones.every((z) => ZONES.includes(z) && z !== 'all') && ['immediate', 'daily', 'paused'].includes(p.frequency)
export function validSubscription(value) {
  try {
    const url = new URL(value.endpoint), host = url.hostname
    const trusted = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') || host === 'web.push.apple.com'
    const key = value.keys?.p256dh, auth = value.keys?.auth
    return value.endpoint.length < 4096 && trusted && url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && typeof key === 'string' && /^[\w-]+={0,2}$/.test(key) && Buffer.from(key, 'base64url').length === 65 && typeof auth === 'string' && /^[\w-]+={0,2}$/.test(auth) && Buffer.from(auth, 'base64url').length === 16
  } catch { return false }
}
export function tokenMatches(actual, expected) {
  return typeof actual === 'string' && typeof expected === 'string' && /^[a-f0-9]{64}$/.test(actual) && actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}
export const argentinaDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(date))
export function eligible(record, type, zone, now) {
  const p = record.preferences
  return p.frequency !== 'paused' && p.types.includes(type) && (zone === 'all' || p.zones.includes(zone)) && (p.frequency !== 'daily' || record.delivered?.[`${type}:${zone}`] !== argentinaDay(now))
}
export async function settleScheduledPush(operation, report) {
  try { report((await operation()).status) }
  catch { report(500) }
}
