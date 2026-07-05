import type { AmazonPlannerSession } from './types'

const DB_NAME = 'gpt-image-playground-amazon-studio'
const DB_VERSION = 1
const STORE_SESSIONS = 'plannerSessions'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function dbTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function getAllAmazonPlannerSessions(): Promise<AmazonPlannerSession[]> {
  return dbTransaction(STORE_SESSIONS, 'readonly', (s) => s.getAll())
}

export function putAmazonPlannerSession(session: AmazonPlannerSession): Promise<IDBValidKey> {
  return dbTransaction(STORE_SESSIONS, 'readwrite', (s) => s.put(session))
}

export function deleteAmazonPlannerSession(id: string): Promise<undefined> {
  return dbTransaction(STORE_SESSIONS, 'readwrite', (s) => s.delete(id))
}
