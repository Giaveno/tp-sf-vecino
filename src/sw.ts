/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { storePushEvent } from './services/push-inbox'
import { normalizePushEvent, notificationPath } from './services/push-payload'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] }
self.skipWaiting(); clientsClaim(); cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))
self.addEventListener('push', (event) => {
  let payload: unknown
  try { payload = event.data?.json() } catch { payload = null }
  const record = normalizePushEvent(payload)
  if (!record) return
  event.waitUntil((async () => {
    await storePushEvent(record).catch(() => undefined)
    await self.registration.showNotification(record.title, { body: record.detail, tag: record.id, icon: '/pwa-192.png', data: { target: record.target } })
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    clients.forEach((client) => client.postMessage({ type: 'push-received' }))
  })())
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(notificationPath(event.notification.data?.target), self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) { await existing.navigate(url); await existing.focus() } else await self.clients.openWindow(url)
  })())
})
