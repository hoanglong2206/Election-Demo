import { getSessionEpoch, type MeetingSession } from './types'

const DB_NAME = 'meeting_copilot_db'
const DB_VERSION = 1
const STORE_NAME = 'sessions'

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      return reject(new Error('IndexedDB is not supported in this environment'))
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export class IndexedDbSessionRepository {
  public async getAll(): Promise<MeetingSession[]> {
    if (!isIndexedDbAvailable()) return []
    try {
      const db = await openDatabase()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const request = store.getAll()

        request.onsuccess = () => {
          const sessions = (request.result as MeetingSession[]) || []
          sessions.sort((a, b) => getSessionEpoch(b) - getSessionEpoch(a))
          resolve(sessions)
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('[IndexedDB] Failed to get all sessions:', err)
      return []
    }
  }

  public async save(session: MeetingSession): Promise<void> {
    if (!isIndexedDbAvailable()) return
    try {
      const db = await openDatabase()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.put(session)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('[IndexedDB] Failed to save session:', err)
    }
  }

  public async delete(sessionId: string): Promise<void> {
    if (!isIndexedDbAvailable()) return
    try {
      const db = await openDatabase()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.delete(sessionId)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('[IndexedDB] Failed to delete session:', err)
    }
  }

  public async deleteMany(sessionIds: string[]): Promise<void> {
    if (!isIndexedDbAvailable()) return
    try {
      const db = await openDatabase()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)

        for (const id of sessionIds) {
          store.delete(id)
        }

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (err) {
      console.warn('[IndexedDB] Failed to delete multiple sessions:', err)
    }
  }

  public async deleteAll(): Promise<void> {
    if (!isIndexedDbAvailable()) return
    try {
      const db = await openDatabase()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('[IndexedDB] Failed to clear all sessions:', err)
    }
  }

  public async rename(sessionId: string, newTitle: string): Promise<void> {
    if (!isIndexedDbAvailable()) return
    try {
      const db = await openDatabase()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const getRequest = store.get(sessionId)

        getRequest.onsuccess = () => {
          const session = getRequest.result as MeetingSession
          if (session) {
            session.title = newTitle.trim()
            store.put(session)
          }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (err) {
      console.warn('[IndexedDB] Failed to rename session:', err)
    }
  }
}
