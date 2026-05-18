import type { ImMessage } from '../types/im'

const DB_NAME = 'tapsss-message-cache'
const STORE_NAME = 'messages'
const DB_VERSION = 1
const MAX_MESSAGES = 100

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getCachedMessages(toUid: string): Promise<ImMessage[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(toUid)
      request.onsuccess = () => resolve((request.result as ImMessage[]) ?? [])
      request.onerror = () => reject(request.error)
    })
  }
  catch {
    return []
  }
}

export async function cacheMessages(toUid: string, messages: ImMessage[]): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const trimmed = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages
      const request = store.put(trimmed, toUid)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
  catch {
    // 缓存写入失败不影响正常功能
  }
}

export async function clearMessageCache(toUid: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(toUid)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
  catch {
    // 清理失败不影响正常功能
  }
}
