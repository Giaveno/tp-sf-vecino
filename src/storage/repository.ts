import type { ClaimRecord, DemoSettings, NotificationRecord, ParkingSession, PaymentRecord, TaxObligation } from '../models/persistence'
import { isValidParkingSession } from '../modules/parking'
import { validateAttachmentData } from '../modules/city'

export interface Repository {
  getClaims(): ClaimRecord[]; saveClaim(claim: ClaimRecord): void
  getPayments(): PaymentRecord[]; savePayment(payment: PaymentRecord): void
  getTaxObligations(): TaxObligation[]; saveTaxObligation(obligation: TaxObligation): void
  getNotifications(): NotificationRecord[]; saveNotifications(notifications: NotificationRecord[]): void
  getParkingSession(includeExpired?: boolean): ParkingSession | null; saveParkingSession(session: ParkingSession): void; clearParkingSession(): void
  getSettings(): DemoSettings; saveSettings(settings: DemoSettings): void
  isPersistent(): boolean
}
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const unavailableStorage: StorageLike = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable') }, removeItem: () => undefined }
const prefix = 'sf-vecino:v1:'
const keys = { claims: `${prefix}claims`, payments: `${prefix}payments`, taxes: `${prefix}tax-obligations`, notifications: `${prefix}notifications`, parking: `${prefix}parking`, settings: `${prefix}settings` }
const defaultNotifications: NotificationRecord[] = [
  { id: 'water-cut', title: 'Corte de agua programado', detail: 'Aviso de demostración · Barrio Centro', read: false, type: 'service', zone: 'centro', target: 'contacts' },
  { id: 'fair', title: 'Feria de emprendedores', detail: 'Actividad simulada · Plaza San Martín', read: false, type: 'service', zone: 'plaza', target: 'contacts' },
]
const defaultTaxes: TaxObligation[] = [
  { id: 'abl-004821-2026-10', concept: 'ABL · Partida 004821', amount: 18450, dueDate: '2026-10-15', status: 'pending' },
  { id: 'commerce-001274-2026-10', concept: 'Comercio · Cuenta 001274', amount: 32700, dueDate: '2026-10-20', status: 'pending' },
  { id: 'vehicle-009813-2026', concept: 'Patente · Dominio AB123CD', amount: 25100, dueDate: '2026-11-05', status: 'pending' },
]
const defaultSettings: DemoSettings = { preferences: { types: ['service', 'tax', 'claim', 'alarm', 'parking'], zones: ['centro', 'terminal', 'plaza'], frequency: 'immediate' }, alarmZones: [], activeAlarms: ['centro'], bicycleReports: [] }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 5000
const date = (value: unknown): boolean => text(value) && Number.isFinite(Date.parse(value))
const amount = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0
const validClaim = (v: unknown): v is ClaimRecord => object(v) && text(v.id) && text(v.category) && text(v.description) && ['received', 'in_review', 'resolved'].includes(String(v.status)) && date(v.createdAt) && (!v.evidence || (object(v.evidence) && validateAttachmentData(v.evidence as unknown as ClaimRecord['evidence'] & {})))
const validPayment = (v: unknown): v is PaymentRecord => object(v) && text(v.id) && text(v.concept) && amount(v.amount) && date(v.paidAt) && text(v.receipt)
const validTax = (v: unknown): v is TaxObligation => object(v) && text(v.id) && text(v.concept) && amount(v.amount) && date(v.dueDate) && ['pending', 'paid'].includes(String(v.status)) && (v.receipt === undefined || text(v.receipt))
const validNotification = (v: unknown): v is NotificationRecord => object(v) && text(v.id) && text(v.title) && text(v.detail) && typeof v.read === 'boolean' && (v.type === undefined || ['service', 'tax', 'claim', 'alarm', 'parking'].includes(String(v.type))) && (v.zone === undefined || ['all', 'centro', 'terminal', 'plaza'].includes(String(v.zone))) && (v.target === undefined || text(v.target)) && (v.createdAt === undefined || date(v.createdAt)) && (v.deliveredAt === undefined || date(v.deliveredAt))
const stringList = (v: unknown, allowed: string[]): v is string[] => Array.isArray(v) && v.length <= 10 && v.every((item) => typeof item === 'string' && allowed.includes(item))
const validSettings = (v: unknown): v is DemoSettings => object(v) && object(v.preferences) && stringList(v.preferences.types, ['service', 'tax', 'claim', 'alarm', 'parking']) && stringList(v.preferences.zones, ['centro', 'terminal', 'plaza']) && ['immediate', 'daily', 'paused'].includes(String(v.preferences.frequency)) && stringList(v.alarmZones, ['centro', 'terminal', 'plaza']) && stringList(v.activeAlarms, ['centro', 'terminal', 'plaza']) && Array.isArray(v.bicycleReports) && v.bicycleReports.length <= 100 && v.bicycleReports.every((r) => object(r) && text(r.id) && text(r.station) && text(r.description) && date(r.createdAt))

export function createRepository(storage: StorageLike): Repository {
  const memory = new Map<string, unknown>(), dirty = new Set<string>()
  const changed = () => { if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('sf-data')) }
  const write = <T>(key: string, value: T): void => {
    memory.set(key, value)
    try { storage.setItem(key, JSON.stringify(value)); dirty.delete(key) } catch { dirty.add(key) }
    changed()
  }
  const read = <T>(key: string, fallback: T, valid: (value: unknown) => value is T): T => {
    if (dirty.has(key)) return memory.get(key) as T
    try {
      const raw = storage.getItem(key)
      if (raw !== null) { const value: unknown = JSON.parse(raw); if (valid(value)) return value }
    } catch { /* Use validated defaults; a rejected write remains authoritative in memory. */ }
    return structuredClone(fallback)
  }
  const list = <T>(key: string, fallback: T[], validItem: (value: unknown) => value is T): T[] => read(key, fallback, (value): value is T[] => Array.isArray(value) && value.length <= 200 && value.every(validItem))
  const getClaims = () => list(keys.claims, [], validClaim)
  const getPayments = () => list(keys.payments, [], validPayment)
  const getTaxes = (): TaxObligation[] => list(keys.taxes, defaultTaxes, validTax).map((tax) => {
    const payment = getPayments().find((p) => p.obligationId === tax.id || p.concept === tax.concept)
    return payment ? { ...tax, status: 'paid', receipt: payment.receipt } : tax
  })
  return {
    getClaims,
    saveClaim: (claim) => {
      const records = getClaims().filter((old) => old.id !== claim.id)
      if ([...records, claim].reduce((sum, item) => sum + (item.evidence?.dataUrl?.length ?? 0), 0) > 2_800_000) throw new Error('El espacio local para adjuntos está completo. Probá sin adjunto o con un archivo más pequeño.')
      write(keys.claims, [...records, claim].slice(-100))
    },
    getPayments, savePayment: (payment) => write(keys.payments, [...getPayments().filter((old) => old.id !== payment.id), payment].slice(-200)),
    getTaxObligations: getTaxes,
    saveTaxObligation: (obligation) => write(keys.taxes, getTaxes().map((old) => old.id === obligation.id ? obligation : old)),
    getNotifications: () => { const records = list(keys.notifications, defaultNotifications, validNotification); if (!memory.has(keys.notifications)) { memory.set(keys.notifications, records); try { storage.setItem(keys.notifications, JSON.stringify(records)) } catch { dirty.add(keys.notifications) } } return records },
    saveNotifications: (records) => write(keys.notifications, records.slice(-200)),
    getParkingSession: (includeExpired = false) => {
      const session = read<ParkingSession | null>(keys.parking, null, (v): v is ParkingSession | null => v === null || isValidParkingSession(v, includeExpired ? -Infinity : Date.now()))
      if (!session) { memory.set(keys.parking, null); try { storage.removeItem(keys.parking) } catch { dirty.add(keys.parking) } }
      return session
    },
    saveParkingSession: (session) => write(keys.parking, session),
    clearParkingSession: () => write(keys.parking, null),
    getSettings: () => read(keys.settings, defaultSettings, validSettings),
    saveSettings: (settings) => write(keys.settings, settings),
    isPersistent: () => dirty.size === 0,
  }
}
export function getBrowserStorage(): StorageLike {
  if (typeof window === 'undefined') return unavailableStorage
  try { return window.localStorage } catch { return unavailableStorage }
}
export const repository = createRepository(getBrowserStorage())
