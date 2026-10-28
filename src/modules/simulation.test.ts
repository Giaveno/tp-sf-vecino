import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => vi.resetModules())

describe('simulated municipal event integration', () => {
  it('creates a separate overdue reminder after an upcoming reminder', async () => {
    const { repository } = await import('../storage/repository')
    const { processScheduledEvents } = await import('./simulation')
    const tax = repository.getTaxObligations()[0]
    repository.saveTaxObligation({ ...tax, dueDate: '2099-01-10' })
    processScheduledEvents(Date.parse('2099-01-09T12:00:00Z'))
    processScheduledEvents(Date.parse('2099-01-12T12:00:00Z'))
    const reminders = repository.getNotifications().filter((item) => item.type === 'tax' && item.detail.includes(tax.concept))
    expect(reminders.map((item) => item.title)).toEqual(['Próximo vencimiento', 'Tributo vencido (simulado)'])
  })
  it('keeps events in history but respects paused delivery and deduplicates ids', async () => {
    const { repository } = await import('../storage/repository')
    const { publishNotification } = await import('./simulation')
    const settings = repository.getSettings()
    repository.saveSettings({ ...settings, preferences: { ...settings.preferences, frequency: 'paused' } })
    const event = { id: 'claim-1', title: 'Claim', detail: 'Received', type: 'claim' as const, zone: 'all', read: false }
    expect(publishNotification(event)).toBe(false)
    expect(publishNotification(event)).toBe(false)
    expect(repository.getNotifications().filter((item) => item.id === 'claim-1')).toHaveLength(1)
  })
  it('notifies before parking expires and clears an expired session only once', async () => {
    const { repository } = await import('../storage/repository')
    const { processScheduledEvents } = await import('./simulation')
    const now = Date.now()
    repository.saveParkingSession({ zoneId: 'centro', startedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 60_000).toISOString() })
    processScheduledEvents(now); processScheduledEvents(now)
    expect(repository.getNotifications().filter((item) => item.type === 'parking')).toHaveLength(1)
    processScheduledEvents(now + 61_000)
    expect(repository.getParkingSession(true)).toBeNull()
    expect(repository.getNotifications().filter((item) => item.type === 'parking')).toHaveLength(2)
  })
  it('only generates an alarm alert on activation in a subscribed or nearby zone', async () => {
    const { repository } = await import('../storage/repository')
    const { toggleAlarm } = await import('./simulation')
    toggleAlarm('terminal')
    expect(repository.getNotifications().filter((item) => item.type === 'alarm')).toHaveLength(0)
    toggleAlarm('terminal')
    repository.saveSettings({ ...repository.getSettings(), alarmZones: ['terminal'] })
    toggleAlarm('terminal')
    expect(repository.getNotifications().filter((item) => item.type === 'alarm')).toHaveLength(1)
  })
  it('does not duplicate due reminders and stops creating reminders for a paid tax', async () => {
    const { repository } = await import('../storage/repository')
    const { processScheduledEvents } = await import('./simulation')
    for (const tax of repository.getTaxObligations()) repository.saveTaxObligation({ ...tax, status: 'paid', receipt: 'SIM' })
    processScheduledEvents(Date.parse('2099-01-01'))
    expect(repository.getNotifications().filter((item) => item.type === 'tax')).toHaveLength(0)
    const tax = repository.getTaxObligations()[0]
    repository.saveTaxObligation({ ...tax, status: 'pending', receipt: undefined })
    processScheduledEvents(Date.parse('2099-01-01')); processScheduledEvents(Date.parse('2099-01-01'))
    expect(repository.getNotifications().filter((item) => item.type === 'tax')).toHaveLength(1)
  })
})
