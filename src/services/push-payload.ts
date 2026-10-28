import type { NotificationRecord } from '../models/persistence'
const targets = ['bicycles', 'taxes', 'claims', 'contacts', 'alarms', 'parking', 'notifications']
export function notificationPath(target: unknown): string { return `/#${typeof target === 'string' && targets.includes(target) ? target : 'notificaciones'}` }
export function normalizePushEvent(value: unknown): NotificationRecord | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Record<string, unknown>
  const text = (key: string, limit: number) => typeof event[key] === 'string' && event[key].length > 0 && event[key].length <= limit
  if (!text('id', 100) || !text('title', 200) || !text('detail', 1000) || !text('createdAt', 100) || !Number.isFinite(Date.parse(event.createdAt as string)) || !['service', 'tax', 'claim', 'alarm', 'parking'].includes(String(event.type)) || !['all', 'centro', 'terminal', 'plaza'].includes(String(event.zone)) || !targets.includes(String(event.target))) return null
  return { id: event.id as string, title: event.title as string, detail: event.detail as string, type: event.type as NotificationRecord['type'], zone: event.zone as string, target: event.target as string, createdAt: event.createdAt as string, deliveredAt: event.createdAt as string, deliveryChannel: 'push', read: false }
}
