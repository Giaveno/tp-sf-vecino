import { useEffect, useState } from 'react'
import { CityMap } from '../components/CityMap'
import { useLocalData, useUserLocation } from '../hooks'
import { ModuleLayout, type ModuleProps } from '../components/ModuleLayout'
import { CITY_POINTS, findNearby, ZONES } from '../modules/city'
import { publishNotification, toggleAlarm } from '../modules/simulation'
import { repository } from '../storage/repository'
import { BICYCLE_STATIONS } from '../data/geography'
import { bicycleSource } from '../services/bicycles'

export function BicyclesModule(props: ModuleProps) {
  useLocalData()
  const [selected, setSelected] = useState('tecnoteca'), [problem, setProblem] = useState(''), [message, setMessage] = useState('')
  const [availability, setAvailability] = useState(bicycleSource.snapshot)
  useEffect(() => bicycleSource.subscribe(setAvailability), [])
  const location = useUserLocation()
  const points = location.position ? findNearby(BICYCLE_STATIONS, location.position) : BICYCLE_STATIONS
  const station = BICYCLE_STATIONS.find((point) => point.id === selected)!
  function report(): void {
    if (problem.trim().length < 5) { setMessage('Describí el problema con al menos cinco caracteres.'); return }
    const settings = repository.getSettings(), id = `BICI-${crypto.randomUUID().slice(0, 8)}`
    repository.saveSettings({ ...settings, bicycleReports: [...settings.bicycleReports, { id, station: station.name, description: problem.trim(), createdAt: new Date().toISOString() }].slice(-100) })
    setProblem(''); setMessage(`Reporte ${id} guardado localmente. No fue enviado al municipio.`)
  }
  return <ModuleLayout id="bicycles" description="Disponibilidad y ubicaciones de demostración. Los reportes quedan en este dispositivo." {...props}>
    <CityMap mode="bicycles" selected={selected} onSelect={setSelected} position={location.position} /><button className="secondary-button" onClick={location.locate} disabled={location.busy}>Buscar estaciones cercanas con mi ubicación</button><p role="status">{location.message}</p>
    <p>Simulación dinámica: disponibilidad actualizada cada diez segundos mientras esta pantalla está abierta.</p>
    <div className="module-list">{points.map((point) => { const count = availability.find((item) => item.id === point.id)!; return <button type="button" className={`data-card ${selected === point.id ? 'selected' : ''}`} key={point.id} onClick={() => setSelected(point.id)} aria-pressed={selected === point.id}><strong>{point.name}</strong><span>{count.bicycles} bicicletas · {count.freeDocks} anclajes libres · capacidad {count.capacity}</span><small>Actualizado {new Date(count.updatedAt).toLocaleTimeString('es-AR')} (simulado)</small>{'distance' in point && <small>{Number(point.distance).toFixed(2)} km en línea recta · posición aproximada</small>}</button> })}</div>
    <form className="module-form" onSubmit={(event) => { event.preventDefault(); report() }}><h2>Reportar un problema</h2><p>Estación: {station.name}</p><label htmlFor="bike-problem">Descripción<textarea id="bike-problem" maxLength={1000} value={problem} onChange={(event) => setProblem(event.target.value)} required minLength={5} /></label><button type="submit" className="primary-button">Guardar reporte simulado</button><p role="status">{message}</p></form>
    <h2>Mis reportes</h2>{repository.getSettings().bicycleReports.map((report) => <article className="info-card" key={report.id}><strong>{report.station}</strong><span>{report.description}</span><small>{report.id} · {new Date(report.createdAt).toLocaleString('es-AR')}</small></article>)}
  </ModuleLayout>
}
export function AlarmsModule(props: ModuleProps) {
  useLocalData()
  const [selected, setSelected] = useState('centro'), location = useUserLocation(), settings = repository.getSettings()
  function subscribe(zone: string): void { repository.saveSettings({ ...settings, alarmZones: settings.alarmZones.includes(zone) ? settings.alarmZones.filter((id) => id !== zone) : [...settings.alarmZones, zone] }) }
  return <ModuleLayout id="alarms" description="Estados y activaciones simulados. Este servicio no recibe emergencias ni controla alarmas reales." {...props}>
    <CityMap mode="alarms" selected={selected} onSelect={setSelected} position={location.position} statuses={Object.fromEntries(CITY_POINTS.map((point) => [point.id, settings.activeAlarms.includes(point.id) ? 'activa' : 'inactiva']))} />
    <button className="secondary-button" onClick={location.locate} disabled={location.busy}>Usar mi ubicación para avisos cercanos</button><p role="status">{location.message}</p><p>Se avisa al simular una activación en una zona suscrita o a menos de 2 km. Tus preferencias de notificaciones controlan su entrega.</p>
    {ZONES.map((zone) => <article key={zone.id} className={`info-card ${settings.activeAlarms.includes(zone.id) ? 'alarm-active' : ''}`}><strong>{zone.name} {selected === zone.id ? '· seleccionada' : ''}</strong><span role="status">{settings.activeAlarms.includes(zone.id) ? 'Alarma activa (simulada)' : 'Sin activación'}</span><label className="check-row"><input type="checkbox" checked={settings.alarmZones.includes(zone.id)} onChange={() => subscribe(zone.id)} />Suscribirme a esta zona</label><button className="secondary-button" onClick={() => toggleAlarm(zone.id, location.position)}>{settings.activeAlarms.includes(zone.id) ? 'Simular desactivación' : 'Simular activación'}</button></article>)}
  </ModuleLayout>
}
export function ContactsModule(props: ModuleProps) {
  const [area, setArea] = useState('Atención al vecino'), [message, setMessage] = useState(''), [sent, setSent] = useState('')
  return <ModuleLayout id="contacts" description="WhatsApp oficial de atención municipal y canales ficticios de demostración. Solo vos decidís si enviás un mensaje en la aplicación externa." {...props}>
    <article className="info-card"><strong>Tana · Atención municipal por WhatsApp</strong><span>Canal publicado en la página oficial de contactos de San Francisco.</span><a className="primary-button" href="https://wa.me/5493564336062" target="_blank" rel="noopener noreferrer">Abrir WhatsApp oficial</a><a href="https://www.sanfrancisco.gov.ar/contenidos/contactos-356" target="_blank" rel="noopener noreferrer">Ver fuente y contactos oficiales</a><small>Abrir el enlace no envía ningún mensaje automáticamente.</small></article>
    {['Atención al vecino', 'Tránsito', 'Ambiente'].map((name, index) => <article className="info-card" key={name}><strong>{name}</strong><span>Teléfono ficticio: +54 000 000 000{index}</span><small>{`area${index}@example.invalid`} · datos no operativos</small><div className="contact-actions"><a href={`tel:+54000000000${index}`}>Llamar (demo)</a><a href={`mailto:area${index}@example.invalid`}>Email (demo)</a><button type="button" className="secondary-button" onClick={() => { setArea(name); document.getElementById('contact-message')?.focus() }}>Mensaje local</button></div></article>)}
    <form className="module-form" onSubmit={(event) => { event.preventDefault(); if (message.trim().length < 5) return; publishNotification({ id: `message-${crypto.randomUUID()}`, title: `Mensaje a ${area} (simulado)`, detail: message.trim(), read: false, type: 'service', zone: 'all', target: 'contacts' }); setMessage(''); setSent('Mensaje guardado en Notificaciones. No se transmitió al municipio.') }}><h2>Mensajería simulada</h2><label htmlFor="contact-area">Área<select id="contact-area" value={area} onChange={(event) => setArea(event.target.value)}>{['Atención al vecino', 'Tránsito', 'Ambiente'].map((name) => <option key={name}>{name}</option>)}</select></label><label htmlFor="contact-message">Mensaje<textarea id="contact-message" value={message} required minLength={5} maxLength={1000} onChange={(event) => setMessage(event.target.value)} /></label><button className="primary-button" type="submit">Guardar mensaje simulado</button><p role="status">{sent}</p></form>
  </ModuleLayout>
}
