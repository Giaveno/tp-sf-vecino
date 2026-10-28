import { describe, expect, it } from 'vitest'
import { createEvidenceMetadata, MAX_EVIDENCE_SIZE, validateClaim, validateEvidenceFile } from './claims'

describe('validación de reclamos', () => {
  it('rejects unknown categories and descriptions above the local form limit', () => {
    expect(validateClaim({ category: 'unknown', description: 'Valid description' }).category).toBeTruthy()
    expect(validateClaim({ category: 'calles', description: 'x'.repeat(2001) }).description).toBeTruthy()
  })
  it('informa los campos obligatorios faltantes', () => {
    expect(validateClaim({ category: '', description: '  ' })).toEqual({ category: 'Seleccioná una categoría.', description: 'Ingresá una descripción.' })
  })
  it('acepta un reclamo completo', () => { expect(validateClaim({ category: 'calles', description: 'Hay un bache.' })).toEqual({}) })
  it('creates safe metadata for an allowed evidence file', () => {
    expect(createEvidenceMetadata({ name: 'foto/banquina.jpg', type: 'image/jpeg', size: 2048 })).toEqual({ name: 'fotobanquina.jpg', type: 'image/jpeg', size: 2048 })
  })
  it('rejects unsupported or oversized evidence', () => {
    expect(createEvidenceMetadata({ name: 'script.exe', type: 'application/octet-stream', size: 10 })).toBeNull()
    expect(createEvidenceMetadata({ name: 'large.jpg', type: 'image/jpeg', size: MAX_EVIDENCE_SIZE + 1 })).toBeNull()
  })
  it('returns accessible validation messages for invalid evidence', () => {
    expect(validateEvidenceFile({ type: 'application/octet-stream', size: 10 })).toBe('La evidencia debe ser JPG, PNG o PDF.')
    expect(validateEvidenceFile({ type: 'image/jpeg', size: MAX_EVIDENCE_SIZE + 1 })).toBe('La evidencia no puede superar los 5 MiB.')
    expect(validateEvidenceFile({ type: 'application/pdf', size: MAX_EVIDENCE_SIZE })).toBeUndefined()
    expect(validateClaim({ category: 'calles', description: 'Hay un bache.', evidenceError: 'La evidencia debe ser JPG, PNG o PDF.' })).toMatchObject({ evidence: 'La evidencia debe ser JPG, PNG o PDF.' })
  })
})
