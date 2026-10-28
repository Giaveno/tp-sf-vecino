import { services } from './data/services'
import type { ServiceId } from './models/service'

export type AppView = 'home' | ServiceId

export function getViewFromHash(hash: string): AppView {
  const id = hash.replace(/^#/, '')
  return id === 'notificaciones' ? 'notifications' : getViewForService(id)
}

export function getViewForService(serviceId: string): AppView {
  return services.some((service) => service.id === serviceId) ? serviceId as ServiceId : 'home'
}
