import type { Service } from '../models/service'

interface ServiceCardProps { service: Service; onSelect: (service: Service) => void }

export function ServiceCard({ service, onSelect }: ServiceCardProps) {
  return <button className="service-card" type="button" onClick={() => onSelect(service)} aria-label={`Abrir ${service.title}`}><span className="card-arrow" aria-hidden="true">↗</span><span className="service-icon" style={{ backgroundColor: service.color }} aria-hidden="true">{service.icon}</span><h3>{service.title}</h3><p>{service.description}</p></button>
}
