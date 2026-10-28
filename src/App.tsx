import { useEffect, useState } from 'react'
import { ServiceCard } from './components/ServiceCard'
import { services } from './data/services'
import { getViewFromHash } from './navigation'
import { ModuleScreen } from './modules'
import type { Service, ServiceId } from './models/service'
import { useLocalData } from './hooks'
import { processScheduledEvents } from './modules/simulation'
import { repository } from './storage/repository'
import './App.css'
import { importPushHistory } from './services/push-client'

function Home({ onSelect, onNotifications }: { onSelect: (service: Service) => void; onNotifications: () => void }) {
  return <main id="inicio" className="content"><section className="welcome" aria-labelledby="welcome-title"><p className="eyebrow">SERVICIOS MUNICIPALES</p><h1 id="welcome-title">Todo San Francisco,<br /><em>más cerca.</em></h1><p className="intro">Tus servicios municipales en una aplicación. Prototipo académico con datos y operaciones simulados.</p></section><section id="servicios" aria-labelledby="services-title"><div className="section-heading"><div><p className="eyebrow">EXPLORÁ</p><h2 id="services-title">¿Qué necesitás hacer?</h2></div><span className="service-count">{services.length} servicios</span></div><div className="service-grid">{services.map((service) => <ServiceCard key={service.id} service={service} onSelect={onSelect} />)}</div></section><button type="button" className="notice-card" onClick={onNotifications}><span className="notice-icon" aria-hidden="true">✦</span><span><span className="eyebrow">NOVEDADES</span><strong>Información para tu barrio</strong><span>Consultá alertas y noticias municipales en un solo lugar.</span></span><span className="arrow" aria-hidden="true">→</span></button></main>
}
function App() {
  useLocalData()
  const [view, setView] = useState(() => getViewFromHash(window.location.hash)), [online, setOnline] = useState(navigator.onLine), [toast, setToast] = useState('')
  const navigate = (id: ServiceId | 'home') => { const hash = id === 'home' ? 'inicio' : id === 'notifications' ? 'notificaciones' : id; if (window.location.hash === `#${hash}`) setView(getViewFromHash(`#${hash}`)); else window.location.hash = hash }
  useEffect(() => {
    const sync = () => { setView(getViewFromHash(window.location.hash)); window.requestAnimationFrame(() => { if (window.location.hash === '#servicios') document.getElementById('servicios')?.scrollIntoView(); else window.scrollTo({ top: 0, behavior: 'instant' }) }) }
    const connection = () => setOnline(navigator.onLine)
    const notify = (event: Event) => setToast((event as CustomEvent<string>).detail)
    window.addEventListener('hashchange', sync); window.addEventListener('online', connection); window.addEventListener('offline', connection); window.addEventListener('sf-toast', notify)
    const importInbox = () => { void importPushHistory() }
    navigator.serviceWorker?.addEventListener('message', importInbox); window.addEventListener('focus', importInbox); importInbox()
    processScheduledEvents(); const timer = window.setInterval(() => processScheduledEvents(), 1000)
    return () => { navigator.serviceWorker?.removeEventListener('message', importInbox); window.removeEventListener('focus', importInbox); window.removeEventListener('hashchange', sync); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); window.removeEventListener('sf-toast', notify); window.clearInterval(timer) }
  }, [])
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 6500); return () => window.clearTimeout(timeout) }, [toast])
  return <div className="app-shell"><a href="#main-content" className="skip-link">Saltar al contenido</a><header className="topbar"><button className="brand" type="button" onClick={() => navigate('home')} aria-label="San Francisco Vecino, inicio"><span className="brand-mark" aria-hidden="true">SF</span><span><strong>San Francisco</strong><small>Vecino · TP5</small></span></button><button className="profile-button" type="button" onClick={() => navigate('notifications')} aria-label="Abrir preferencias de notificaciones">⚙</button></header>
    <div className="demo-banner">Demostración académica · datos locales · sin trámites ni cobros reales</div>{!online && <p className="connection-banner" role="status">Sin conexión. Podés usar los servicios simulados y los datos guardados.</p>}{!repository.isPersistent() && <p className="storage-warning" role="alert">El navegador no permitió guardar todos los cambios. Están disponibles en esta sesión, pero podrían perderse al cerrar. Descargá los comprobantes y adjuntos importantes.</p>}{toast && <div className="toast" role="status">{toast}<button aria-label="Cerrar aviso" onClick={() => setToast('')}>×</button></div>}
    <div id="main-content" tabIndex={-1}>{view === 'home' ? <Home onSelect={(service) => navigate(service.id)} onNotifications={() => navigate('notifications')} /> : <ModuleScreen serviceId={view} onBack={() => navigate('home')} onNavigate={navigate} />}</div><nav className="bottom-nav" aria-label="Navegación principal"><a className={view === 'home' ? 'active' : ''} href="#inicio" aria-current={view === 'home' ? 'page' : undefined}><span aria-hidden="true">⌂</span>Inicio</a><a href="#servicios"><span aria-hidden="true">◆</span>Servicios</a><a className={view === 'notifications' ? 'active' : ''} href="#notificaciones" aria-current={view === 'notifications' ? 'page' : undefined}><span aria-hidden="true">♢</span>Notificaciones</a></nav></div>
}
export default App
