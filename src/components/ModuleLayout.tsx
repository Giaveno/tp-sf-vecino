import type { ReactNode } from 'react'
import type { ServiceId } from '../models/service'
export interface ModuleProps { onBack: () => void; onNavigate: (id: ServiceId) => void }
const titles: Record<ServiceId, string> = { bicycles: 'Bicicletas públicas', taxes: 'Tributos municipales', claims: 'Centro de reclamos', contacts: 'Líneas de atención', alarms: 'Alarmas comunitarias', parking: 'Estacionamiento medido', notifications: 'Notificaciones' }
export function ModuleLayout({ id, description, onBack, children }: { id: ServiceId; description: string; onBack: () => void; children: ReactNode }) {
  return <main className="content module-page" id={id}><button className="back-button" type="button" onClick={onBack}>← Volver al inicio</button><p className="eyebrow">SERVICIO MUNICIPAL · DEMOSTRACIÓN</p><h1>{titles[id]}</h1><p className="module-description">{description}</p><div className="module-content">{children}</div></main>
}
