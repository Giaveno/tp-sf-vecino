import type { NotificationRecord } from '../models/persistence'
import { repository } from '../storage/repository'
import { CITY_POINTS, distanceKm, shouldDeliver, type Coordinates } from './city'

export function publishNotification(event: NotificationRecord): boolean {
  const history = repository.getNotifications()
  if (history.some((previous) => previous.id === event.id)) return false
  const record = { ...event, createdAt: event.createdAt ?? new Date().toISOString(), deliveryChannel: 'local' as const, read: false }
  const deliver = shouldDeliver(record, repository.getSettings().preferences, history)
  repository.saveNotifications([...history, { ...record, deliveredAt: deliver ? record.createdAt : undefined }])
  if (deliver && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sf-toast', { detail: record.title }))
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(record.title, { body: record.detail, tag: record.id }) } catch { /* In-app history is always available. */ }
    }
  }
  return deliver
}
export function processScheduledEvents(now = Date.now()): void {
  for (const tax of repository.getTaxObligations()) {
    const due = Date.parse(`${tax.dueDate}T23:59:59`)
    if (tax.status === 'pending' && due - now <= 3 * 86_400_000) publishNotification({ id: `due-${tax.id}-${due < now ? 'overdue' : 'upcoming'}`, type: 'tax', zone: 'all', title: due < now ? 'Tributo vencido (simulado)' : 'Próximo vencimiento', detail: `${tax.concept} vence el ${tax.dueDate}.`, target: 'taxes', read: false })
  }
  const parking = repository.getParkingSession(true)
  if (!parking) return
  const seconds = (Date.parse(parking.expiresAt) - now) / 1000
  if (seconds <= 0) {
    publishNotification({ id: `parking-end-${parking.startedAt}`, type: 'parking', zone: parking.zoneId, title: 'Estacionamiento finalizado', detail: 'La sesión simulada venció. Iniciá otra si necesitás continuar.', target: 'parking', read: false })
    repository.clearParkingSession()
  } else if (seconds <= 300) publishNotification({ id: `parking-warning-${parking.expiresAt}`, type: 'parking', zone: parking.zoneId, title: 'Tu estacionamiento está por vencer', detail: 'Quedan menos de cinco minutos. Podés extender la sesión.', target: 'parking', read: false })
}
export function toggleAlarm(zone: string, origin?: Coordinates): void {
  const settings = repository.getSettings(), active = settings.activeAlarms.includes(zone)
  repository.saveSettings({ ...settings, activeAlarms: active ? settings.activeAlarms.filter((id) => id !== zone) : [...settings.activeAlarms, zone] })
  const point = CITY_POINTS.find((item) => item.zone === zone)
  const nearby = origin && point ? distanceKm(origin, point) <= 2 : false
  if (!active && (settings.alarmZones.includes(zone) || nearby)) publishNotification({ id: `alarm-${zone}-${crypto.randomUUID()}`, type: 'alarm', zone, title: 'Activación de alarma simulada', detail: `${point?.name ?? zone}: ${nearby ? 'alarma a menos de 2 km de tu ubicación' : 'zona a la que te suscribiste'}. No representa una emergencia real.`, target: 'alarms', read: false })
}
