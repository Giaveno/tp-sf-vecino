export type ClaimStatus = 'received' | 'in_review' | 'resolved'

export interface ClaimEvidence {
  name: string
  type: string
  size: number
  dataUrl?: string
}

export interface ClaimRecord {
  id: string
  category: string
  description: string
  evidence?: ClaimEvidence
  status: ClaimStatus
  createdAt: string
}

export interface PaymentRecord {
  id: string
  obligationId?: string
  concept: string
  amount: number
  paidAt: string
  receipt: string
}

export type TaxObligationStatus = 'pending' | 'paid'

export interface TaxObligation {
  id: string
  concept: string
  amount: number
  dueDate: string
  status: TaxObligationStatus
  receipt?: string
}

export interface NotificationRecord {
  id: string
  title: string
  detail: string
  read: boolean
  type?: NotificationType
  zone?: string
  createdAt?: string
  deliveredAt?: string
  deliveryChannel?: 'local' | 'push'
  target?: string
}

export type NotificationType = 'service' | 'tax' | 'claim' | 'alarm' | 'parking'
export interface NotificationPreferences { types: NotificationType[]; zones: string[]; frequency: 'immediate' | 'daily' | 'paused' }
export interface DemoSettings { preferences: NotificationPreferences; alarmZones: string[]; activeAlarms: string[]; bicycleReports: { id: string; station: string; description: string; createdAt: string }[] }

export interface ParkingSession {
  zoneId: string
  startedAt: string
  expiresAt: string
}
