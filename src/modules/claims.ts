import type { ClaimEvidence } from '../models/persistence'

export const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024
export const MAX_LOCAL_EVIDENCE_SIZE = 512 * 1024
export const ALLOWED_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const

export interface ClaimForm { category: string; description: string; evidence?: ClaimEvidence; evidenceError?: string }

export function validateClaim(form: ClaimForm): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!['alumbrado', 'residuos', 'calles'].includes(form.category)) errors.category = 'Seleccioná una categoría.'
  if (!form.description.trim()) errors.description = 'Ingresá una descripción.'
  else if (form.description.trim().length > 2000) errors.description = 'La descripción no puede superar los 2000 caracteres.'
  if (form.evidenceError) errors.evidence = form.evidenceError
  return errors
}

export function validateEvidenceFile(file: Pick<File, 'type' | 'size'>): string | undefined {
  if (!ALLOWED_EVIDENCE_TYPES.includes(file.type as typeof ALLOWED_EVIDENCE_TYPES[number])) return 'La evidencia debe ser JPG, PNG o PDF.'
  if (file.size < 0 || file.size > MAX_EVIDENCE_SIZE) return 'La evidencia no puede superar los 5 MiB.'
  return undefined
}

export function createEvidenceMetadata(file: Pick<File, 'name' | 'type' | 'size'>): ClaimEvidence | null {
  if (validateEvidenceFile(file)) return null
  return { name: file.name.replace(/[\\/\0]/g, '').slice(0, 120), type: file.type, size: file.size }
}
