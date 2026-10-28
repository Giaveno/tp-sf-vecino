export const PARKING_SESSION_MINUTES = 60
export const PARKING_EXTENSION_MINUTES = 30

export interface ParkingZone {
  id: string
  name: string
  ratePerHour: number
  schedule: string
}

export const PARKING_ZONES: ParkingZone[] = [
  { id: 'centro', name: 'Zona Centro', ratePerHour: 250, schedule: 'Lunes a viernes, de 8 a 13 h y de 16 a 20 h' },
  { id: 'terminal', name: 'Zona Terminal', ratePerHour: 180, schedule: 'Lunes a viernes, de 8 a 18 h' },
  { id: 'plaza', name: 'Zona Plaza', ratePerHour: 220, schedule: 'Lunes a sábados, de 9 a 20 h' },
]

export function findParkingZone(zoneId: string): ParkingZone | undefined {
  return PARKING_ZONES.find((zone) => zone.id === zoneId)
}

export function isValidParkingSession(session: unknown, now = Date.now()): session is { zoneId: string; startedAt: string; expiresAt: string } {
  if (!session || typeof session !== 'object') return false
  const candidate = session as Partial<{ zoneId: string; startedAt: string; expiresAt: string }>
  if (typeof candidate.zoneId !== 'string' || !findParkingZone(candidate.zoneId)) return false
  if (typeof candidate.startedAt !== 'string' || typeof candidate.expiresAt !== 'string') return false
  const startedAt = Date.parse(candidate.startedAt)
  const expiresAt = Date.parse(candidate.expiresAt)
  return Number.isFinite(startedAt) && Number.isFinite(expiresAt) && startedAt <= expiresAt && expiresAt > now
}

export function createParkingSession(zoneId: string, now = Date.now()): { zoneId: string; startedAt: string; expiresAt: string } | null {
  if (!findParkingZone(zoneId)) return null
  return { zoneId, startedAt: new Date(now).toISOString(), expiresAt: new Date(now + PARKING_SESSION_MINUTES * 60_000).toISOString() }
}

export interface ParkingTimerScheduler {
  setInterval(callback: () => void, milliseconds: number): number
  clearInterval(timer: number): void
}

export function getRemainingSeconds(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000))
}

export function extendParkingSession(expiresAt: string, minutes: number, now = Date.now()): string {
  const currentExpiry = Math.max(Date.parse(expiresAt), now)
  return new Date(currentExpiry + minutes * 60_000).toISOString()
}

export function startParkingTimer(
  expiresAt: string,
  onTick: () => void,
  onExpire: () => void,
  scheduler: ParkingTimerScheduler,
  now = Date.now(),
): () => void {
  if (getRemainingSeconds(expiresAt, now) === 0) {
    onExpire()
    return () => undefined
  }

  const timer = scheduler.setInterval(() => {
    if (getRemainingSeconds(expiresAt) === 0) {
      scheduler.clearInterval(timer)
      onExpire()
      return
    }
    onTick()
  }, 1000)

  return () => scheduler.clearInterval(timer)
}
