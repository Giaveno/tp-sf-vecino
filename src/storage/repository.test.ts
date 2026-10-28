import { describe, expect, it } from 'vitest'
import { createRepository, getBrowserStorage, type StorageLike } from './repository'

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

describe('local repository', () => {
  it('keeps the latest write when quota rejects replacing an existing value', () => {
    const original = JSON.stringify([{ id: 'old', category: 'calles', description: 'Old', status: 'received', createdAt: '2026-10-08' }])
    const store: StorageLike = { getItem: () => original, setItem: () => { throw new Error('quota') }, removeItem: () => undefined }
    const repository = createRepository(store)
    repository.saveClaim({ id: 'new', category: 'calles', description: 'New', status: 'received', createdAt: '2026-10-09' })
    expect(repository.getClaims().map((item) => item.id)).toEqual(['old', 'new'])
  })

  it('rejects malformed elements instead of exposing them to screens', () => {
    const repository = createRepository(createMemoryStorage({ 'sf-vecino:v1:claims': '[null,{"id":7}]', 'sf-vecino:v1:payments': '[null]', 'sf-vecino:v1:tax-obligations': '[null]', 'sf-vecino:v1:notifications': '[null]' }))
    expect(repository.getClaims()).toEqual([])
    expect(repository.getPayments()).toEqual([])
    expect(repository.getTaxObligations()).toHaveLength(3)
    expect(repository.getNotifications()).toHaveLength(2)
  })
  it('persists claims and payments using namespaced keys', () => {
    const storage = createMemoryStorage()
    const first = createRepository(storage)
    first.saveClaim({ id: 'REC-1', category: 'calles', description: 'Bache', evidence: { name: 'bache.jpg', type: 'image/jpeg', size: 2048 }, status: 'received', createdAt: '2026-10-08' })
    first.savePayment({ id: 'PAY-1', concept: 'ABL', amount: 18450, paidAt: '2026-10-08', receipt: 'SIM-1' })

    const second = createRepository(storage)
    expect(second.getClaims()).toHaveLength(1)
    expect(second.getClaims()[0]?.evidence).toEqual({ name: 'bache.jpg', type: 'image/jpeg', size: 2048 })
    expect(second.getPayments()[0]?.receipt).toBe('SIM-1')
  })

  it('migrates an existing payment into the matching tax obligation', () => {
    const storage = createMemoryStorage()
    const repository = createRepository(storage)
    repository.savePayment({ id: 'PAY-legacy', concept: 'ABL · Partida 004821', amount: 18450, paidAt: '2026-10-08', receipt: 'SIM-legacy' })
    expect(repository.getTaxObligations().find((item) => item.concept === 'ABL · Partida 004821')).toMatchObject({ status: 'paid', receipt: 'SIM-legacy' })
  })

  it('provides multiple simulated tax obligations', () => {
    const obligations = createRepository(createMemoryStorage()).getTaxObligations()
    expect(obligations).toHaveLength(3)
    expect(obligations.every((item) => item.status === 'pending')).toBe(true)
  })

  it('uses defaults when stored JSON is corrupt', () => {
    const storage = createMemoryStorage({ 'sf-vecino:v1:claims': '{invalid', 'sf-vecino:v1:notifications': '{invalid' })
    const repository = createRepository(storage)
    expect(repository.getClaims()).toEqual([])
    expect(repository.getNotifications()).toHaveLength(2)
    expect(storage.getItem('sf-vecino:v1:notifications')).toContain('water-cut')
  })

  it('uses an unavailable storage adapter when localStorage access throws', () => {
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { get localStorage(): never { throw new Error('blocked') } } })
    expect(getBrowserStorage().getItem('any-key')).toBeNull()
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  })

  it('persists and clears a parking session', () => {
    const repository = createRepository(createMemoryStorage())
    repository.saveParkingSession({ zoneId: 'centro', startedAt: '2099-10-08T10:00:00.000Z', expiresAt: '2099-10-08T11:00:00.000Z' })
    expect(repository.getParkingSession()?.expiresAt).toContain('11:00')
    repository.clearParkingSession()
    expect(repository.getParkingSession()).toBeNull()
  })

  it('clears unknown-zone, invalid-date, and expired sessions', () => {
    const unknownZoneStorage = createMemoryStorage({ 'sf-vecino:v1:parking': JSON.stringify({ zoneId: 'unknown', startedAt: '2099-10-08T10:00:00.000Z', expiresAt: '2099-10-08T11:00:00.000Z' }) })
    expect(createRepository(unknownZoneStorage).getParkingSession()).toBeNull()
    expect(unknownZoneStorage.getItem('sf-vecino:v1:parking')).toBeNull()

    const invalidDateStorage = createMemoryStorage({ 'sf-vecino:v1:parking': JSON.stringify({ zoneId: 'centro', startedAt: 'invalid', expiresAt: '2099-10-08T11:00:00.000Z' }) })
    expect(createRepository(invalidDateStorage).getParkingSession()).toBeNull()
    expect(invalidDateStorage.getItem('sf-vecino:v1:parking')).toBeNull()

    const expiredStorage = createMemoryStorage({ 'sf-vecino:v1:parking': JSON.stringify({ zoneId: 'centro', startedAt: '2020-10-08T10:00:00.000Z', expiresAt: '2020-10-08T11:00:00.000Z' }) })
    expect(createRepository(expiredStorage).getParkingSession()).toBeNull()
    expect(expiredStorage.getItem('sf-vecino:v1:parking')).toBeNull()
  })
})
