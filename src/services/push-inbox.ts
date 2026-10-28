import type { NotificationRecord } from '../models/persistence'
function openInbox(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sf-vecino-push', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('events', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Inbox unavailable'))
  })
}
export async function storePushEvent(event: NotificationRecord): Promise<void> {
  const db = await openInbox()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('events', 'readwrite'), store = transaction.objectStore('events')
      store.put(event)
      const all = store.getAll()
      all.onsuccess = () => { const events = (all.result as NotificationRecord[]).sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')); events.slice(0, Math.max(0, events.length - 100)).forEach((item) => store.delete(item.id)) }
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error)
    })
  } finally { db.close() }
}
export async function readPushInbox(): Promise<NotificationRecord[]> {
  const db = await openInbox()
  try { return await new Promise((resolve, reject) => { const request = db.transaction('events', 'readonly').objectStore('events').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
  finally { db.close() }
}
