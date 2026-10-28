import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ModuleLayout, type ModuleProps } from '../components/ModuleLayout'
import { useLocalData } from '../hooks'
import { createEvidenceMetadata, MAX_LOCAL_EVIDENCE_SIZE, validateClaim, validateEvidenceFile, type ClaimForm } from '../modules/claims'
import { downloadEvidence, nextClaimStatus } from '../modules/city'
import { publishNotification } from '../modules/simulation'
import { repository } from '../storage/repository'

const labels = { received: 'Recibido', in_review: 'En revisión', resolved: 'Resuelto' }
export function ClaimsModule(props: ModuleProps) {
  useLocalData()
  const [form, setForm] = useState<ClaimForm>({ category: '', description: '' }), [errors, setErrors] = useState<Record<string, string>>({}), [query, setQuery] = useState(''), [status, setStatus] = useState(''), [reading, setReading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null), selection = useRef(0)
  const claims = repository.getClaims().filter((claim) => `${claim.id} ${claim.category} ${claim.description} ${labels[claim.status]}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')))
  function submit(event: FormEvent): void {
    event.preventDefault()
    const next = validateClaim(form); setErrors(next)
    if (reading || Object.keys(next).length) return
    const id = `REC-${crypto.randomUUID().slice(0, 8)}`
    try {
      repository.saveClaim({ id, category: form.category, description: form.description.trim(), evidence: form.evidence, status: 'received', createdAt: new Date().toISOString() })
      publishNotification({ id: `received-${id}`, type: 'claim', title: `Reclamo ${id} recibido`, detail: 'Registrado localmente para la demostración.', target: 'claims', zone: 'all', read: false })
      setForm({ category: '', description: '' }); if (fileInput.current) fileInput.current.value = ''; setStatus(`Reclamo ${id} registrado. No se envió al municipio.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo guardar el reclamo.') }
  }
  function selectEvidence(file?: File): void {
    const token = ++selection.current
    setReading(false); setForm((current) => ({ ...current, evidence: undefined, evidenceError: undefined })); setErrors((current) => { const next = { ...current }; delete next.evidence; return next })
    if (!file) return
    const error = validateEvidenceFile(file) ?? (file.size > MAX_LOCAL_EVIDENCE_SIZE ? `Para el almacenamiento local, el adjunto no puede superar los ${MAX_LOCAL_EVIDENCE_SIZE / 1024} KiB.` : undefined)
    if (error) { setForm((current) => ({ ...current, evidenceError: error })); setErrors((current) => ({ ...current, evidence: error })); return }
    const reader = new FileReader(); setReading(true)
    reader.onload = () => { if (token !== selection.current) return; const metadata = createEvidenceMetadata(file); if (metadata && typeof reader.result === 'string') setForm((current) => ({ ...current, evidence: { ...metadata, dataUrl: reader.result as string } })); setReading(false) }
    reader.onerror = () => { if (token !== selection.current) return; const error = 'No se pudo leer el archivo. Seleccioná otro.'; setForm((current) => ({ ...current, evidenceError: error })); setErrors((current) => ({ ...current, evidence: error })); setReading(false) }
    reader.readAsDataURL(file)
  }
  function advance(id: string): void {
    const claim = repository.getClaims().find((item) => item.id === id)
    if (!claim || claim.status === 'resolved') return
    try {
      const next = { ...claim, status: nextClaimStatus(claim.status) }; repository.saveClaim(next)
      publishNotification({ id: `status-${id}-${next.status}`, type: 'claim', title: `Reclamo ${id}: ${labels[next.status]}`, detail: 'Actualización simulada del área municipal.', target: 'claims', zone: 'all', read: false })
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo actualizar.') }
  }
  return <ModuleLayout id="claims" description="Registrá reclamos con adjuntos locales y demostrá su seguimiento. Se conserva un máximo de 100 reclamos en este navegador." {...props}>
    <form className="module-form" onSubmit={submit} noValidate><label htmlFor="claim-category">Categoría<select id="claim-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? 'category-error' : undefined}><option value="">Seleccioná una categoría</option><option value="alumbrado">Alumbrado público</option><option value="residuos">Residuos</option><option value="calles">Calles</option></select>{errors.category && <span id="category-error" className="field-error" role="alert">{errors.category}</span>}</label>
      <label htmlFor="claim-description">Descripción<textarea id="claim-description" maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-error' : undefined} />{errors.description && <span id="description-error" className="field-error" role="alert">{errors.description}</span>}</label>
      <label htmlFor="claim-evidence">Adjunto opcional<input id="claim-evidence" ref={fileInput} type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => selectEvidence(event.target.files?.[0])} aria-invalid={Boolean(errors.evidence)} aria-describedby="evidence-help evidence-error" /><small id="evidence-help">JPG, PNG o PDF hasta 512 KiB. Se guarda el archivo completo localmente; capacidad conjunta de adjuntos aproximada: 2 MiB. No adjuntes información sensible.</small><span id="evidence-error" className="field-error" role={errors.evidence ? 'alert' : undefined}>{errors.evidence}</span>{form.evidence && <span>Archivo seleccionado: {form.evidence.name}</span>}</label><button className="primary-button" type="submit" disabled={reading}>{reading ? 'Leyendo archivo…' : 'Enviar reclamo simulado'}</button></form>
    <p role="status" className="status-message">{status || 'Los reclamos y sus archivos permanecen en este dispositivo.'}</p><h2>Historial de reclamos</h2><label className="filter-label" htmlFor="claim-search">Buscar por número, categoría, descripción o estado<input id="claim-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    {claims.length === 0 ? <p>No hay reclamos que coincidan.</p> : claims.slice().reverse().map((claim) => <article className="info-card" key={claim.id}><strong>{claim.id} · {claim.category}</strong><span>{claim.description}</span><small>{new Date(claim.createdAt).toLocaleString('es-AR')}</small><ol className="progress-list" aria-label="Progreso del reclamo">{(['received', 'in_review', 'resolved'] as const).map((step) => <li key={step} aria-current={claim.status === step ? 'step' : undefined}>{labels[step]}</li>)}</ol>{claim.evidence && <div><small>Adjunto: {claim.evidence.name} · {Math.ceil(claim.evidence.size / 1024)} KiB</small>{claim.evidence.dataUrl ? <button type="button" className="secondary-button" onClick={() => { if (!downloadEvidence(claim.evidence!)) setStatus('El adjunto est? da?ado o no pudo descargarse. Volv? a seleccionar el archivo original.') }}>Descargar adjunto</button> : <p>Registro anterior: solo conserva metadatos del archivo.</p>}</div>}{claim.status !== 'resolved' && <button className="secondary-button" onClick={() => advance(claim.id)}>Simular avance a {labels[nextClaimStatus(claim.status)]}</button>}</article>)}
  </ModuleLayout>
}
