import { describe, expect, it } from 'vitest'
import { getViewForService, getViewFromHash } from './navigation'

describe('navegación de servicios', () => {
  it('restores deep links and the notification alias for browser back navigation', () => {
    expect(getViewFromHash('#claims')).toBe('claims')
    expect(getViewFromHash('#notificaciones')).toBe('notifications')
    expect(getViewFromHash('#servicios')).toBe('home')
    expect(getViewFromHash('#unknown')).toBe('home')
  })
  it('resuelve cada servicio a su pantalla', () => {
    expect(getViewForService('bicycles')).toBe('bicycles')
    expect(getViewForService('notifications')).toBe('notifications')
  })

  it('vuelve al inicio para un servicio desconocido', () => {
    expect(getViewForService('unknown')).toBe('home')
  })
})
