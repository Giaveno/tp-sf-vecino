import type { ComponentType } from 'react'
import type { ServiceId } from './models/service'
import type { ModuleProps } from './components/ModuleLayout'
import { BicyclesModule, ContactsModule, AlarmsModule } from './screens/Community'
import { TaxesModule, ParkingModule } from './screens/Finances'
import { ClaimsModule } from './screens/Claims'
import { NotificationsModule } from './screens/Notifications'
const modules: Record<ServiceId, ComponentType<ModuleProps>> = { bicycles: BicyclesModule, taxes: TaxesModule, claims: ClaimsModule, contacts: ContactsModule, alarms: AlarmsModule, parking: ParkingModule, notifications: NotificationsModule }
export function ModuleScreen({ serviceId, onBack, onNavigate }: ModuleProps & { serviceId: ServiceId }) {
  const SelectedModule = modules[serviceId]
  return <SelectedModule key={serviceId} onBack={onBack} onNavigate={onNavigate} />
}
