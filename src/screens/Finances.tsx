import { useEffect, useState } from 'react'
import { ModuleLayout, type ModuleProps } from '../components/ModuleLayout'
import { CityMap } from '../components/CityMap'
import { useLocalData } from '../hooks'
import { generateCedulon, payTaxObligation } from '../modules/taxes'
import { createParkingSession, extendParkingSession, findParkingZone, getRemainingSeconds, PARKING_EXTENSION_MINUTES, PARKING_SESSION_MINUTES, PARKING_ZONES } from '../modules/parking'
import { downloadText, receiptText } from '../modules/city'
import { processScheduledEvents, publishNotification } from '../modules/simulation'
import { repository } from '../storage/repository'

const money = (amount: number) => amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })
export function TaxesModule(props: ModuleProps) {
  useLocalData()
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer) }, [])
  const obligations = repository.getTaxObligations(), [id, setId] = useState(obligations[0]?.id ?? ''), [message, setMessage] = useState('')
  const selected = obligations.find((item) => item.id === id), payments = repository.getPayments().filter((item) => !item.concept.startsWith('Estacionamiento'))
  function pay(): void {
    if (!selected || selected.status === 'paid') return
    const result = payTaxObligation(selected); repository.savePayment(result.payment); repository.saveTaxObligation(result.obligation)
    setMessage(`Pago simulado registrado: ${result.payment.receipt}. No se efectuó ningún cobro.`)
    publishNotification({ id: `paid-${selected.id}`, title: 'Pago simulado registrado', detail: selected.concept, type: 'tax', zone: 'all', target: 'taxes', read: false })
  }
  return <ModuleLayout id="taxes" description="Obligaciones ficticias, cedulones y pagos simulados. No ingreses tarjetas ni claves bancarias." {...props}>
    <p className="status-message" role="status">{message || 'Los vencimientos generan recordatorios locales mientras la aplicación está abierta.'}</p>
    {obligations.map((tax) => <button className={`data-card ${tax.id === id ? 'selected' : ''}`} type="button" key={tax.id} aria-pressed={tax.id === id} onClick={() => setId(tax.id)}><strong>{tax.concept}</strong><span>$ {money(tax.amount)} · vence {tax.dueDate}</span><small>{tax.status === 'paid' ? 'Pagado' : Date.parse(`${tax.dueDate}T23:59:59`) < now ? 'Pendiente · vencido' : 'Pendiente'}</small></button>)}
    {selected && <article className="info-card"><strong>{selected.concept}</strong><span>$ {money(selected.amount)} · Vencimiento {selected.dueDate}</span><button className="secondary-button" onClick={() => downloadText(`cedulon-${selected.id}.txt`, receiptText(selected.concept, generateCedulon(selected), selected.amount, selected.dueDate) + 'Documento de obligación simulada. No acredita pago.')} >Descargar cedulón</button><button className="primary-button" onClick={pay} disabled={selected.status === 'paid'}>{selected.status === 'paid' ? 'Obligación pagada' : 'Confirmar pago simulado'}</button></article>}
    <button className="secondary-button" onClick={() => { processScheduledEvents(); setMessage('Vencimientos comprobados. Consultá el historial de Notificaciones.') }}>Comprobar recordatorios de vencimiento</button><h2>Historial de pagos</h2>{payments.length ? payments.slice().reverse().map((payment) => <article key={payment.id} className="info-card"><strong>{payment.concept}</strong><span>$ {money(payment.amount)} · {new Date(payment.paidAt).toLocaleString('es-AR')}</span><small>{payment.receipt}</small><button className="secondary-button" onClick={() => downloadText(`${payment.receipt}.txt`, receiptText(payment.concept, payment.receipt, payment.amount, payment.paidAt))}>Descargar comprobante</button></article>) : <p>Sin pagos registrados.</p>}
  </ModuleLayout>
}
export function ParkingModule(props: ModuleProps) {
  useLocalData()
  const session = repository.getParkingSession(true), [selected, setSelected] = useState(session?.zoneId ?? 'centro'), [, tick] = useState(0), [message, setMessage] = useState('')
  const zone = findParkingZone(session?.zoneId ?? selected)!, remaining = session ? getRemainingSeconds(session.expiresAt) : 0
  useEffect(() => { const timer = window.setInterval(() => tick((value) => value + 1), 1000); return () => window.clearInterval(timer) }, [])
  function pay(extend = false): void {
    const now = Date.now(), previous = repository.getParkingSession(true)
    const next = extend && previous ? { ...previous, expiresAt: extendParkingSession(previous.expiresAt, PARKING_EXTENSION_MINUTES) } : createParkingSession(selected, now)
    if (!next) return
    const duration = extend ? PARKING_EXTENSION_MINUTES : PARKING_SESSION_MINUTES
    const amount = zone.ratePerHour * duration / 60, receipt = `SIM-PARK-${crypto.randomUUID().slice(0, 8)}`
    repository.savePayment({ id: receipt, concept: `Estacionamiento ${zone.name}${extend ? ' · extensión 30 min' : ' · 60 min'}`, amount, paidAt: new Date(now).toISOString(), receipt })
    repository.saveParkingSession(next); setMessage(`Pago simulado $ ${money(amount)} confirmado. Comprobante ${receipt}.`)
  }
  const payments = repository.getPayments().filter((payment) => payment.concept.startsWith('Estacionamiento'))
  return <ModuleLayout id="parking" description="Zonas, tarifas y horarios ficticios. Pagos y comprobantes de demostración; no habilitan estacionamiento real." {...props}>
    <CityMap mode="parking" selected={session?.zoneId ?? selected} onSelect={(id) => { if (!session) setSelected(id) }} />
    {PARKING_ZONES.map((item) => <button className={`data-card ${(session?.zoneId ?? selected) === item.id ? 'selected' : ''}`} key={item.id} disabled={Boolean(session)} aria-pressed={(session?.zoneId ?? selected) === item.id} onClick={() => setSelected(item.id)}><strong>{item.name} · $ {money(item.ratePerHour)} por hora</strong><span>{item.schedule}</span></button>)}
    <article className="info-card"><strong>{zone.name}</strong><span>{zone.schedule}</span><p className="timer" aria-label="Tiempo restante">{session ? `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}` : 'Sin sesión activa'}</p>{session ? <><small>Vence: {new Date(session.expiresAt).toLocaleTimeString('es-AR')}</small><button className="primary-button" onClick={() => pay(true)} disabled={remaining === 0}>Pagar extensión simulada de 30 min · $ {money(zone.ratePerHour / 2)}</button><button className="secondary-button" onClick={() => { repository.clearParkingSession(); setMessage('Sesión finalizada voluntariamente. El pago simulado permanece en el historial.') }}>Finalizar sesión</button><button className="secondary-button" onClick={() => { repository.saveParkingSession({ ...session, expiresAt: new Date(Date.now() + 120_000).toISOString() }); processScheduledEvents() }}>Demostrar aviso de vencimiento (dejar 2 min)</button></> : <button className="primary-button" onClick={() => pay()}>Pagar e iniciar 60 min simulados · $ {money(zone.ratePerHour)}</button>}</article><p className="status-message" role="status">{message || 'Aviso local al quedar cinco minutos y al vencer. La aplicación debe permanecer abierta.'}</p>
    <h2>Comprobantes de estacionamiento</h2>{payments.length ? payments.slice().reverse().map((payment) => <article className="info-card" key={payment.id}><strong>{payment.concept}</strong><span>$ {money(payment.amount)}</span><small>{new Date(payment.paidAt).toLocaleString('es-AR')}</small><button className="secondary-button" onClick={() => downloadText(`${payment.receipt}.txt`, receiptText(payment.concept, payment.receipt, payment.amount, payment.paidAt))}>Descargar comprobante</button></article>) : <p>Sin pagos registrados.</p>}
  </ModuleLayout>
}
