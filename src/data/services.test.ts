import { describe, expect, it } from 'vitest'
import { findServiceById, services } from './services'

describe('catálogo de servicios', () => {
  it('incluye los siete servicios municipales definidos', () => {
    expect(services).toHaveLength(7)
    expect(new Set(services.map((service) => service.id)).size).toBe(7)
  })

  it('permite recuperar un servicio por identificador', () => {
    expect(findServiceById('parking')?.title).toBe('Estacionamiento medido')
    expect(findServiceById('unknown')).toBeUndefined()
  })
})
