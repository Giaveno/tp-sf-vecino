import type { PaymentRecord, TaxObligation } from '../models/persistence'

export interface TaxPaymentResult {
  obligation: TaxObligation
  payment: PaymentRecord
}

export function generateCedulon(obligation: TaxObligation): string {
  return `CED-${obligation.id.toUpperCase()}-${obligation.dueDate.replaceAll('-', '')}`
}

export function payTaxObligation(obligation: TaxObligation, paidAt = new Date().toISOString()): TaxPaymentResult {
  if (obligation.status === 'paid' && obligation.receipt) {
    throw new Error('La obligación ya fue pagada.')
  }
  const receipt = `SIM-${obligation.id}-${Date.parse(paidAt)}`
  return {
    obligation: { ...obligation, status: 'paid', receipt },
    payment: { id: `PAY-${obligation.id}-${Date.parse(paidAt)}`, obligationId: obligation.id, concept: obligation.concept, amount: obligation.amount, paidAt, receipt },
  }
}
