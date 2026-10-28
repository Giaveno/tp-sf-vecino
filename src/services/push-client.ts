import type { NotificationPreferences } from '../models/persistence'
import { repository } from '../storage/repository'
import { readPushInbox } from './push-inbox'
import { normalizePushEvent } from './push-payload'

interface PushAccount { id: string; token: string }
let memory: PushAccount | null = null
const key = 'sf-vecino:push-account'
function account(): PushAccount | null {
  try { const value = JSON.parse(localStorage.getItem(key) ?? 'null'); return value && typeof value.id === 'string' && typeof value.token === 'string' ? value : memory } catch { return memory }
}
function saveAccount(value: PushAccount | null) { memory = value; try { if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key) } catch { /* This session can still use push. */ } }
async function api(path: string, body?: unknown) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`/api/push/${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: controller.signal })
    const result = await response.json().catch(() => ({ error: 'Iniciá el servidor Node para usar Web Push.' }))
    if (!response.ok) throw new Error(result.error ?? 'No fue posible completar la operación push.')
    return result
  } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw new Error('El emisor local no respondió a tiempo. El historial sigue disponible.'); throw error }
  finally { clearTimeout(timer) }
}
export function hasPushAccount(): boolean { return Boolean(account()) }
export function pushSupported(): boolean { return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window }
export async function enablePush(preferences: NotificationPreferences): Promise<void> {
  if (!pushSupported()) throw new Error('Web Push requiere un navegador compatible y localhost o HTTPS. El historial interno sigue disponible.')
  if (await Notification.requestPermission() !== 'granted') throw new Error('Permiso no concedido. Podés continuar con el historial dentro de la app.')
  const config = await api('config'), raw = atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/'))
  const applicationServerKey = Uint8Array.from(raw, (character) => character.charCodeAt(0))
  const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('El service worker no está listo. Ejecutá el build y abrí la aplicación desde Node.')), 8000))])
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
  saveAccount(await api('subscriptions', { ...account(), subscription: subscription.toJSON(), preferences }))
}
export async function syncPushPreferences(preferences: NotificationPreferences): Promise<void> { const value = account(); if (value) await api('preferences', { ...value, preferences }) }
export async function disablePush(): Promise<void> {
  const value = account()
  if (!('serviceWorker' in navigator)) { saveAccount(null); return }
  const registration = await navigator.serviceWorker.getRegistration(), subscription = await registration?.pushManager.getSubscription()
  if (subscription && !(await subscription.unsubscribe())) throw new Error('El navegador no pudo cancelar la suscripción. Volvé a intentar.')
  saveAccount(null)
  if (value) await api('unsubscribe', value)
}
export async function sendPushDemo(type: string, zone: string) {
  const value = account(); if (!value) throw new Error('Activá Web Push primero.')
  return api('demo', { ...value, type, zone, delaySeconds: 10 })
}
export async function importPushHistory(): Promise<void> {
  try {
    const events = (await readPushInbox()).map(normalizePushEvent).filter((event) => event !== null)
    const history = repository.getNotifications()
    const unseen = events.filter((event) => !history.some((item) => item.id === event.id))
    if (unseen.length) repository.saveNotifications([...history, ...unseen])
  } catch { /* Private modes may block IndexedDB; system delivery can still work. */ }
}
