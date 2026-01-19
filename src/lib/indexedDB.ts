/**
 * IndexedDB Storage Layer
 * Production-grade persistent storage for offline-first operation
 */

const DB_NAME = 'watchguard_db';
const DB_VERSION = 1;

interface DBStores {
  visitors: 'visitors';
  pdls: 'pdls';
  pdl_visitor_links: 'pdl_visitor_links';
  visit_sessions: 'visit_sessions';
  biometrics: 'biometrics';
  users: 'users';
  audit_logs: 'audit_logs';
  settings: 'settings';
  sync_queue: 'sync_queue';
}

const STORES: DBStores = {
  visitors: 'visitors',
  pdls: 'pdls',
  pdl_visitor_links: 'pdl_visitor_links',
  visit_sessions: 'visit_sessions',
  biometrics: 'biometrics',
  users: 'users',
  audit_logs: 'audit_logs',
  settings: 'settings',
  sync_queue: 'sync_queue',
};

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IDB] Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('[IDB] Upgrading database schema...');

        // Create object stores with indexes
        if (!db.objectStoreNames.contains(STORES.visitors)) {
          const visitors = db.createObjectStore(STORES.visitors, { keyPath: 'id' });
          visitors.createIndex('visitor_code', 'visitor_code', { unique: true });
          visitors.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.pdls)) {
          const pdls = db.createObjectStore(STORES.pdls, { keyPath: 'id' });
          pdls.createIndex('pdl_code', 'pdl_code', { unique: true });
          pdls.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.pdl_visitor_links)) {
          const links = db.createObjectStore(STORES.pdl_visitor_links, { keyPath: 'id' });
          links.createIndex('pdl_id', 'pdl_id', { unique: false });
          links.createIndex('visitor_id', 'visitor_id', { unique: false });
          links.createIndex('approval_status', 'approval_status', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.visit_sessions)) {
          const sessions = db.createObjectStore(STORES.visit_sessions, { keyPath: 'id' });
          sessions.createIndex('visitor_id', 'visitor_id', { unique: false });
          sessions.createIndex('pdl_id', 'pdl_id', { unique: false });
          sessions.createIndex('time_in', 'time_in', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.biometrics)) {
          const biometrics = db.createObjectStore(STORES.biometrics, { keyPath: 'id' });
          biometrics.createIndex('visitor_id', 'visitor_id', { unique: true });
        }

        if (!db.objectStoreNames.contains(STORES.users)) {
          const users = db.createObjectStore(STORES.users, { keyPath: 'id' });
          users.createIndex('username', 'username', { unique: true });
          users.createIndex('email', 'email', { unique: true });
        }

        if (!db.objectStoreNames.contains(STORES.audit_logs)) {
          const logs = db.createObjectStore(STORES.audit_logs, { keyPath: 'id' });
          logs.createIndex('user_id', 'user_id', { unique: false });
          logs.createIndex('action', 'action', { unique: false });
          logs.createIndex('created_at', 'created_at', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.sync_queue)) {
          const queue = db.createObjectStore(STORES.sync_queue, { keyPath: 'id', autoIncrement: true });
          queue.createIndex('timestamp', 'timestamp', { unique: false });
          queue.createIndex('synced', 'synced', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.init();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Generic CRUD operations
  async getAll<T>(storeName: string): Promise<T[]> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getById<T>(storeName: string, id: string): Promise<T | undefined> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
    const store = await this.getStore(storeName);
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T extends { id: string }>(storeName: string, data: T): Promise<T> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Bulk operations
  async bulkPut<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
    const db = await this.init();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      for (const item of items) {
        store.put(item);
      }
    });
  }

  // Settings operations
  async getSetting<T>(key: string): Promise<T | null> {
    const store = await this.getStore(STORES.settings);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore(STORES.settings, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue operations
  async addToSyncQueue(operation: { type: string; store: string; data: unknown }): Promise<void> {
    const store = await this.getStore(STORES.sync_queue, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.add({
        ...operation,
        timestamp: new Date().toISOString(),
        synced: false,
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSyncItems(): Promise<unknown[]> {
    const items = await this.getByIndex(STORES.sync_queue, 'synced', false as unknown as IDBValidKey);
    return items;
  }

  // Export all data
  async exportAll(): Promise<Record<string, unknown[]>> {
    const data: Record<string, unknown[]> = {};
    
    for (const storeName of Object.values(STORES)) {
      if (storeName !== 'sync_queue') {
        data[storeName] = await this.getAll(storeName);
      }
    }
    
    return data;
  }

  // Import data (for migration from localStorage)
  async importData(data: Record<string, unknown[]>): Promise<void> {
    for (const [storeName, items] of Object.entries(data)) {
      if (Object.values(STORES).includes(storeName as keyof DBStores) && Array.isArray(items)) {
        await this.bulkPut(storeName, items as { id: string }[]);
      }
    }
  }
}

// Singleton instance
export const idb = new IndexedDBStorage();

// Initialize on module load
idb.init().catch(console.error);
