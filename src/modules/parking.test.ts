import { describe, expect, it, vi } from 'vitest'
import { createParkingSession, extendParkingSession, findParkingZone, getRemainingSeconds, isValidParkingSession, startParkingTimer } from './parking'

describe('parking operations', () => {
  it('creates sessions only for valid zones and preserves the selected zone', () => {
    expect(createParkingSession('centro', Date.parse('2026-10-08T10:00:00.000Z'))).toMatchObject({ zoneId: 'centro', startedAt: '2026-10-08T10:00:00.000Z' })
    expect(findParkingZone('unknown')).toBeUndefined()
    expect(createParkingSession('unknown')).toBeNull()
  })
  it('rejects corrupted, unknown-zone, invalid-date, and expired sessions', () => {
    const now = Date.parse('2026-10-08T10:00:00.000Z')
    expect(isValidParkingSession({ zoneId: 'centro', startedAt: 'not-a-date', expiresAt: '2026-10-08T11:00:00.000Z' }, now)).toBe(false)
    expect(isValidParkingSession({ zoneId: 'unknown', startedAt: '2026-10-08T09:00:00.000Z', expiresAt: '2026-10-08T11:00:00.000Z' }, now)).toBe(false)
    expect(isValidParkingSession({ zoneId: 'centro', startedAt: '2026-10-08T11:00:00.000Z', expiresAt: '2026-10-08T10:00:00.000Z' }, now)).toBe(false)
    expect(isValidParkingSession({ zoneId: 'centro', startedAt: '2026-10-08T09:00:00.000Z', expiresAt: '2026-10-08T09:30:00.000Z' }, now)).toBe(false)
    expect(isValidParkingSession(null, now)).toBe(false)
  })
  it('calculates remaining seconds without going below zero', () => {
    expect(getRemainingSeconds('2026-10-08T11:00:00.000Z', Date.parse('2026-10-08T10:59:30.000Z'))).toBe(30)
    expect(getRemainingSeconds('2026-10-08T10:00:00.000Z', Date.parse('2026-10-08T11:00:00.000Z'))).toBe(0)
  })

  it('extends from the later of now or the current expiry', () => {
    expect(extendParkingSession('2026-10-08T11:00:00.000Z', 30, Date.parse('2026-10-08T10:00:00.000Z'))).toBe('2026-10-08T11:30:00.000Z')
  })

  it('clears the interval and expires the session when time reaches zero', () => {
    vi.useFakeTimers()
    let callback: (() => void) | undefined
    let clearedTimer: number | undefined
    const scheduler = {
      setInterval: (next: () => void) => { callback = next; return 7 },
      clearInterval: (timer: number) => { clearedTimer = timer },
    }
    const onExpire = vi.fn()
    startParkingTimer('2026-10-08T10:00:01.000Z', vi.fn(), onExpire, scheduler, Date.parse('2026-10-08T10:00:00.000Z'))

    vi.setSystemTime(Date.parse('2026-10-08T10:00:01.000Z'))
    callback?.()

    expect(clearedTimer).toBe(7)
    expect(onExpire).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
