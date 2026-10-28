import { describe, expect, it } from 'vitest'
import { distanceKm, findNearby, filterNotifications, matchesPreferences, nextClaimStatus, receiptText, shouldDeliver, validateAttachmentData } from './city'

describe('municipal simulation behavior', () => {
  it('calculates distance and sorts nearby points without inventing a location', () => {
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0)
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.195, 2)
    expect(findNearby([{ id: 'far', latitude: 1, longitude: 1 }, { id: 'near', latitude: 0, longitude: 0 }], { latitude: 0, longitude: 0 })[0].id).toBe('near')
  })
  it('filters notifications by type and zone and leaves unrelated records intact', () => {
    const records = [{ id: '1', title: 'A', detail: 'A', read: false, type: 'alarm' as const, zone: 'centro', createdAt: '2026-10-27' }, { id: '2', title: 'B', detail: 'B', read: false, type: 'tax' as const, zone: 'all', createdAt: '2026-10-27' }]
    expect(filterNotifications(records, 'alarm', 'centro').map((item) => item.id)).toEqual(['1'])
    expect(filterNotifications(records, 'all', 'centro')).toHaveLength(2)
  })
  it('applies type zone and daily delivery preferences', () => {
    const preferences = { types: ['alarm' as const], zones: ['centro'], frequency: 'daily' as const }
    const event = { id: 'n', title: 'Alarm', detail: 'D', read: false, type: 'alarm' as const, zone: 'centro', createdAt: '2026-10-27T10:00:00Z' }
    expect(matchesPreferences(event, preferences)).toBe(true)
    expect(matchesPreferences({ ...event, zone: 'terminal' }, preferences)).toBe(false)
    expect(shouldDeliver(event, preferences, [{ ...event, id: 'old', deliveredAt: event.createdAt }])).toBe(false)
    expect(shouldDeliver(event, { ...preferences, frequency: 'immediate' }, [])).toBe(true)
    expect(shouldDeliver(event, { ...preferences, frequency: 'paused' }, [])).toBe(false)
  })
  it('counts actual deliveries by the city local date rather than UTC or suppressed history', () => {
    const preferences = { types: ['alarm' as const], zones: ['centro'], frequency: 'daily' as const }
    const event = { id: 'new', title: 'Alarm', detail: 'D', read: false, type: 'alarm' as const, zone: 'centro', createdAt: '2026-10-28T01:00:00Z' }
    expect(shouldDeliver(event, preferences, [{ ...event, id: 'old', createdAt: '2026-10-27T23:00:00Z', deliveredAt: '2026-10-27T23:00:00Z' }])).toBe(false)
    expect(shouldDeliver(event, preferences, [{ ...event, id: 'suppressed' }])).toBe(true)
  })
  it('rejects executable or inconsistent persisted attachments', () => {
    expect(validateAttachmentData({ name: 'photo.png', type: 'image/png', size: 3, dataUrl: 'data:image/png;base64,YWJj' })).toBe(true)
    expect(validateAttachmentData({ name: 'x.svg', type: 'image/svg+xml', size: 3, dataUrl: 'data:image/svg+xml;base64,YWJj' })).toBe(false)
    expect(validateAttachmentData({ name: 'photo.png', type: 'image/png', size: 3, dataUrl: 'javascript:alert(1)' })).toBe(false)
    expect(validateAttachmentData({ name: 'broken.pdf', type: 'application/pdf', size: 1, dataUrl: 'data:application/pdf;base64,A' })).toBe(false)
    expect(validateAttachmentData({ name: 'wrong-size.pdf', type: 'application/pdf', size: 9, dataUrl: 'data:application/pdf;base64,YWJj' })).toBe(false)
  })
  it('advances claims only to the next permitted state', () => {
    expect(nextClaimStatus('received')).toBe('in_review')
    expect(nextClaimStatus('in_review')).toBe('resolved')
    expect(nextClaimStatus('resolved')).toBe('resolved')
  })
  it('generates a clearly simulated receipt without payment card information', () => {
    expect(receiptText('Parking', 'SIM-123', 250, '2026-10-27')).toContain('SIN VALIDEZ FISCAL')
    expect(receiptText('Parking', 'SIM-123', 250, '2026-10-27')).toContain('SIM-123')
  })
})
