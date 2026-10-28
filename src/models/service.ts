export interface Service {
  id: string
  title: string
  description: string
  icon: string
  color: string
}

export type ServiceId = Service['id']
