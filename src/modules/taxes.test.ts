import { describe, expect, it } from 'vitest'
import { generateCedulon, payTaxObligation } from './taxes'
import type { TaxObligation } from '../models/persistence'

const obligation: TaxObligation = { id: 'abl-004821-2026-10', concept: 'ABL · Partida 004821', amount: 18450, dueDate: '2026-10-15', status: 'pending' }

describe('tax operations', () => {
  it('generates a deterministic simulated cedulón', () => { expect(generateCedulon(obligation)).toBe('CED-ABL-004821-2026-10-20261015') })
  it('pays a pending obligation and creates its receipt', () => {
    const result = payTaxObligation(obligation, '2026-10-13T12:00:00.000Z')
    expect(result.obligation).toMatchObject({ status: 'paid' })
    expect(result.obligation.receipt).toMatch(/^SIM-abl-004821-2026-10-/)
    expect(result.payment).toMatchObject({ obligationId: obligation.id, amount: 18450, receipt: result.obligation.receipt })
  })
  it('does not pay an obligation twice', () => { expect(() => payTaxObligation({ ...obligation, status: 'paid', receipt: 'SIM-old' }, '2026-10-13T12:00:00.000Z')).toThrow('ya fue pagada') })
})
