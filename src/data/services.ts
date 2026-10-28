import type { Service } from '../models/service'

export const services: Service[] = [
  { id: 'bicycles', title: 'Bicicletas públicas', description: 'Encontrá una bici cerca tuyo.', icon: '⌁', color: '#d7eadb' },
  { id: 'taxes', title: 'Tributos municipales', description: 'Consultá y pagá tus tributos.', icon: '$', color: '#e9e0d3' },
  { id: 'claims', title: 'Centro de reclamos', description: 'Reportá un problema en tu barrio.', icon: '⌁', color: '#e7dfef' },
  { id: 'contacts', title: 'Líneas de atención', description: 'Estamos para ayudarte.', icon: '◌', color: '#dfe9ed' },
  { id: 'alarms', title: 'Alarmas comunitarias', description: 'Cuidarnos es tarea de todos.', icon: '♢', color: '#f0e0de' },
  { id: 'parking', title: 'Estacionamiento medido', description: 'Activá tu estacionamiento.', icon: 'P', color: '#d7eadb' },
  { id: 'notifications', title: 'Notificaciones', description: 'Novedades de tu ciudad.', icon: '♧', color: '#eee5d4' },
]

export function findServiceById(id: string): Service | undefined {
  return services.find((service) => service.id === id)
}
