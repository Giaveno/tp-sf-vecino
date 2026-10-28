import { describe, expect, it, vi } from 'vitest'
import type { NotificationRecord } from '../models/persistence'
const state = vi.hoisted(() => ({ records: [] as NotificationRecord[], read: vi.fn<() => Promise<NotificationRecord[]>>() }))
vi.mock('./push-inbox', () => ({ readPushInbox: () => state.read() }))
vi.mock('../storage/repository', () => ({ repository: { getNotifications: () => state.records, saveNotifications: (records: NotificationRecord[]) => { state.records = records } } }))
import { importPushHistory } from './push-client'

describe('background history import', () => {
  it('preserves local events and read state changed while IndexedDB is pending', async () => {
    const event = { id: 'push-test', title: 'Aviso', detail: 'Prueba', type: 'service' as const, zone: 'all', target: 'contacts', createdAt: '2026-10-28T12:00:00Z', read: false }
    let complete!: (value: NotificationRecord[]) => void
    state.read.mockReturnValue(new Promise((resolve) => { complete = resolve }))
    state.records = [{ ...event, id: 'existing' }]
    const pending = importPushHistory()
    state.records = [{ ...event, id: 'existing', read: true }, { ...event, id: 'parking-expired' }]
    complete([event]); await pending
    expect(state.records.map((record) => record.id)).toEqual(['existing', 'parking-expired', 'push-test'])
    expect(state.records[0].read).toBe(true)
    await importPushHistory()
    expect(state.records).toHaveLength(3)
  })
})
