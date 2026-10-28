import type { ClaimEvidence, ClaimStatus, NotificationPreferences, NotificationRecord } from '../models/persistence'
import { ALLOWED_EVIDENCE_TYPES, MAX_EVIDENCE_SIZE, MAX_LOCAL_EVIDENCE_SIZE } from './claims'
import { ALARM_POINTS } from '../data/geography'

export interface Coordinates { latitude: number; longitude: number }
export interface MapPoint extends Coordinates { id: string; name: string; zone: string }
export const CITY_POINTS: MapPoint[] = ALARM_POINTS
export const ZONES = [{ id: 'centro', name: 'Centro' }, { id: 'terminal', name: 'Terminal' }, { id: 'plaza', name: 'Plaza' }]
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const radians = (n: number) => n * Math.PI / 180
  const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
}
export function findNearby<T extends Coordinates>(points: T[], origin: Coordinates): (T & { distance: number })[] {
  return points.map((point) => ({ ...point, distance: distanceKm(origin, point) })).sort((a, b) => a.distance - b.distance)
}
export function filterNotifications(records: NotificationRecord[], type: string, zone: string): NotificationRecord[] {
  return records.filter((record) => (type === 'all' || (record.type ?? 'service') === type) && (zone === 'all' || !record.zone || record.zone === 'all' || record.zone === zone))
}
export function matchesPreferences(record: NotificationRecord, preferences: NotificationPreferences): boolean {
  return preferences.types.includes(record.type ?? 'service') && (!record.zone || record.zone === 'all' || preferences.zones.includes(record.zone))
}
export function shouldDeliver(record: NotificationRecord, preferences: NotificationPreferences, history: NotificationRecord[]): boolean {
  if (!matchesPreferences(record, preferences) || preferences.frequency === 'paused') return false
  if (preferences.frequency === 'immediate') return true
  const localDay = (date: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(date))
  return !history.some((previous) => previous.deliveryChannel !== 'push' && previous.deliveredAt && previous.type === record.type && previous.zone === record.zone && localDay(previous.deliveredAt) === localDay(record.createdAt ?? new Date().toISOString()))
}
export function validateAttachmentData(evidence: ClaimEvidence): boolean {
  if (!ALLOWED_EVIDENCE_TYPES.includes(evidence.type as typeof ALLOWED_EVIDENCE_TYPES[number]) || !Number.isFinite(evidence.size) || evidence.size < 0 || evidence.size > (evidence.dataUrl ? MAX_LOCAL_EVIDENCE_SIZE : MAX_EVIDENCE_SIZE) || typeof evidence.name !== 'string') return false
  if (!evidence.dataUrl) return true // Legacy metadata remains readable, but is not presented as an attachment.
  const payload = evidence.dataUrl.split(',')[1]
  if (!evidence.dataUrl.startsWith(`data:${evidence.type};base64,`) || evidence.dataUrl.length > 710_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload ?? '!')) return false
  try { return atob(payload).length === evidence.size } catch { return false }
}
export function nextClaimStatus(status: ClaimStatus): ClaimStatus { return status === 'received' ? 'in_review' : 'resolved' }
export function receiptText(concept: string, receipt: string, amount: number, date: string): string {
  return `SAN FRANCISCO VECINO\nSIMULACIÓN ACADÉMICA - SIN VALIDEZ FISCAL\n${concept}\nComprobante: ${receipt}\nImporte: $ ${amount.toFixed(2)}\nFecha: ${date}\nNo se efectuó ningún cobro real.\n`
}
export function downloadText(name: string, text: string): void { downloadBlob(name, new Blob([text], { type: 'text/plain;charset=utf-8' })) }
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = name.replace(/[\\/\0]/g, ''); anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function downloadEvidence(evidence: ClaimEvidence): boolean {
  if (!validateAttachmentData(evidence) || !evidence.dataUrl) return false
  try {
    const binary = atob(evidence.dataUrl.split(',')[1]), bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    downloadBlob(evidence.name, new Blob([bytes], { type: evidence.type }))
    return true
  } catch { return false }
}
