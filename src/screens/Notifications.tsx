import { useState } from 'react'
import { ModuleLayout, type ModuleProps } from '../components/ModuleLayout'
import { useLocalData } from '../hooks'
import { filterNotifications, ZONES } from '../modules/city'
import { publishNotification } from '../modules/simulation'
import { repository } from '../storage/repository'
import type { NotificationPreferences, NotificationType } from '../models/persistence'
import { getViewForService } from '../navigation'
import { disablePush, enablePush, hasPushAccount, sendPushDemo, syncPushPreferences } from '../services/push-client'

const types: { id: NotificationType; name: string }[] = [{ id: 'service', name: 'Novedades' }, { id: 'tax', name: 'Tributos' }, { id: 'claim', name: 'Reclamos' }, { id: 'alarm', name: 'Alarmas' }, { id: 'parking', name: 'Estacionamiento' }]
export function NotificationsModule(props: ModuleProps) {
  useLocalData()
  const [type, setType] = useState('all'), [zone, setZone] = useState('all'), [message, setMessage] = useState('')
  const [pushActive, setPushActive] = useState(hasPushAccount), [pushBusy, setPushBusy] = useState(false)
  const settings = repository.getSettings(), preferences = settings.preferences, records = filterNotifications(repository.getNotifications(), type, zone).slice().reverse()
  function update(next: NotificationPreferences): void {
    repository.saveSettings({ ...settings, preferences: next }); setMessage('Preferencias guardadas. Controlan los avisos nuevos; el historial conserva todos los eventos.')
    void syncPushPreferences(next).catch(() => setMessage('Preferencias locales guardadas, pero el emisor push no pudo actualizarlas. Desactivá push o reiniciá el servidor y volvé a guardarlas.'))
  }
  async function pushAction(action: 'enable' | 'disable' | 'demo'): Promise<void> {
    setPushBusy(true)
    try {
      if (action === 'enable') { await enablePush(preferences); setPushActive(true); setMessage('Web Push activado. El emisor Node debe permanecer funcionando y tener Internet.') }
      else if (action === 'disable') { await disablePush(); setPushActive(false); setMessage('Suscripción del navegador cancelada.') }
      else {
        await syncPushPreferences(preferences)
        const result = await sendPushDemo(type === 'all' ? 'service' : type, zone)
        setMessage(result.suppressed ? 'Tus preferencias limitaron este envío. Revisá tipo, zona y frecuencia.' : 'Aviso programado para dentro de diez segundos. Podés cerrar esta pestaña manteniendo el navegador y Node funcionando. La recepción depende de los permisos del sistema.')
      }
    } catch (error) { setPushActive(hasPushAccount()); setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación push. El historial sigue disponible.') }
    finally { setPushBusy(false) }
  }
  return <ModuleLayout id="notifications" description="Avisos municipales de demostración. Web Push usa un emisor Node real; el contenido municipal y los eventos locales son simulados." {...props}>
    <section className="module-form"><h2>Web Push real</h2><p>Requiere permiso, Internet y el servidor Node local. La pestaña puede cerrarse; mantené el navegador funcionando. Sin permiso o sin servidor podés usar el historial local.</p><div className="contact-actions"><button className="secondary-button" disabled={pushBusy} onClick={() => void pushAction('enable')}>{pushActive ? 'Reactivar o comprobar Web Push' : 'Activar Web Push'}</button><button className="secondary-button" disabled={pushBusy} onClick={() => void pushAction('disable')}>Desactivar Web Push</button><button className="primary-button" disabled={pushBusy || !pushActive} onClick={() => void pushAction('demo')}>Programar push de prueba en 10 segundos</button></div><small>El envío usa el tipo y la zona seleccionados en los filtros de abajo. Solo se envía a tu propia suscripción. No publica alertas reales ni contactos al municipio.</small></section>
    <section className="module-form" aria-labelledby="notification-preferences"><h2 id="notification-preferences">Preferencias de avisos</h2><fieldset><legend>Tipos que quiero recibir</legend>{types.map((item) => <label key={item.id} className="check-row"><input type="checkbox" checked={preferences.types.includes(item.id)} onChange={() => update({ ...preferences, types: preferences.types.includes(item.id) ? preferences.types.filter((id) => id !== item.id) : [...preferences.types, item.id] })} />{item.name}</label>)}</fieldset><fieldset><legend>Zonas de interés</legend>{ZONES.map((item) => <label className="check-row" key={item.id}><input type="checkbox" checked={preferences.zones.includes(item.id)} onChange={() => update({ ...preferences, zones: preferences.zones.includes(item.id) ? preferences.zones.filter((id) => id !== item.id) : [...preferences.zones, item.id] })} />{item.name}</label>)}</fieldset>
      <label htmlFor="notification-frequency">Frecuencia<select id="notification-frequency" value={preferences.frequency} onChange={(event) => update({ ...preferences, frequency: event.target.value as NotificationPreferences['frequency'] })}><option value="immediate">Cada evento</option><option value="daily">Máximo un aviso por tipo y zona al día por canal</option><option value="paused">Pausar avisos</option></select></label><small>Los recordatorios generales no están asociados a una zona. Pausar avisos no elimina el historial. El límite diario se aplica por separado a los eventos locales y Web Push; no programa un envío futuro.</small>
    </section>
    <button className="secondary-button" onClick={() => { const delivered = publishNotification({ id: `demo-${crypto.randomUUID()}`, title: 'Novedad municipal simulada', detail: `Evento de demostración para ${zone === 'all' ? 'todas las zonas' : zone}.`, type: type === 'all' ? 'service' : type as NotificationType, zone, target: type === 'alarm' ? 'alarms' : type === 'parking' ? 'parking' : type === 'tax' ? 'taxes' : type === 'claim' ? 'claims' : 'contacts', read: false }); setMessage(delivered ? 'Evento guardado y aviso entregado dentro de la aplicación.' : 'Evento guardado; tus preferencias limitaron la entrega del aviso.') }}>Simular una notificación</button><p className="status-message" role="status">{message || 'Configurá tus preferencias o generá un evento para probarlas.'}</p>
    <h2>Historial y filtros</h2><div className="filter-row"><label htmlFor="notification-type">Tipo<select id="notification-type" value={type} onChange={(event) => setType(event.target.value)}><option value="all">Todos</option>{types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label htmlFor="notification-zone">Zona<select id="notification-zone" value={zone} onChange={(event) => setZone(event.target.value)}><option value="all">Todas</option>{ZONES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    {records.length ? records.map((record) => <article key={record.id} className={`info-card ${record.read ? '' : 'alarm-active'}`}><strong>{record.title}</strong><span>{record.detail}</span><small>{record.zone ?? 'all'} · {record.createdAt ? new Date(record.createdAt).toLocaleString('es-AR') : 'Aviso inicial de demostración'} · {record.read ? 'Leída' : 'Nueva'}</small><div className="contact-actions">{!record.read && <button className="secondary-button" onClick={() => repository.saveNotifications(repository.getNotifications().map((item) => item.id === record.id ? { ...item, read: true } : item))}>Marcar como leída</button>}{record.target && <button className="secondary-button" onClick={() => { const target = getViewForService(record.target!); if (target !== 'home') props.onNavigate(target) }}>Ver servicio relacionado</button>}</div></article>) : <p>No hay avisos con estos filtros.</p>}
  </ModuleLayout>
}
