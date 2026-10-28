import { describe, expect, it } from 'vitest'
import { normalizePushEvent, notificationPath } from './push-payload'
import { shouldDeliver } from '../modules/city'

describe('push payload boundaries', () => {
  const event = { id: 'push-test', title: 'Aviso', detail: 'Prueba', type: 'alarm', zone: 'centro', target: 'alarms', createdAt: '2026-10-28T12:00:00Z' }
  it('imports delivered events with a safe internal destination', () => {
    expect(normalizePushEvent(event)?.deliveredAt).toBe(event.createdAt)
    expect(notificationPath(event.target)).toBe('/#alarms')
    expect(notificationPath('https://evil.test')).toBe('/#notificaciones')
    const remote = normalizePushEvent(event)!
    expect(shouldDeliver({ ...remote, id: 'local' }, { types: ['alarm'], zones: ['centro'], frequency: 'daily' }, [remote])).toBe(true)
  })
  it('rejects malformed or oversized remote payloads', () => {
    expect(normalizePushEvent({ ...event, target: 'https://evil.test' })).toBeNull()
    expect(normalizePushEvent({ ...event, title: 'a'.repeat(201) })).toBeNull()
    expect(normalizePushEvent({ ...event, createdAt: 'invalid' })).toBeNull()
  })
})
