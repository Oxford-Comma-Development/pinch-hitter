import { AppSettings, BallEvent, CoachNote, Player, PracticeSession, Team } from './models';

export interface DatabaseRecords {
  teams: Team;
  players: Player;
  sessions: PracticeSession;
  events: BallEvent;
  notes: CoachNote;
  settings: AppSettings;
}
export type TableName = keyof DatabaseRecords;
export type DatabaseSnapshot = { [K in TableName]: DatabaseRecords[K][] };
export interface DatabaseChange {
  table: TableName;
  put?: DatabaseRecords[TableName][];
  delete?: string[];
}
export const DATABASE_NAME = 'pinch-hitter';
export const LEGACY_DATABASE_NAME = 'baseball-coach-helper';
export const DATABASE_VERSION = 2;
const TABLES: TableName[] = ['teams', 'players', 'sessions', 'events', 'notes', 'settings'];

export class ConcurrentWriteError extends Error {
  constructor() {
    super('Another Pinch Hitter window changed this practice. Try the action again.');
  }
}

/** Native IndexedDB. A capture writes its event and queue snapshot in one transaction. */
export class CoachRepository {
  private database: IDBDatabase | null = null;
  private revision: string | null = null;
  constructor(private readonly databaseName = DATABASE_NAME) {}

  async open(): Promise<void> {
    if (this.database) return;
    if (!globalThis.indexedDB)
      throw new Error(
        'This browser cannot open local storage. Open Pinch Hitter in a browser with IndexedDB enabled.',
      );
    this.database = await this.openDb(this.databaseName);
    if (this.databaseName === DATABASE_NAME) {
      await this.migrateLegacyDatabaseIfPresent();
    }
  }

  private openDb(name: string): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, DATABASE_VERSION);
      request.onupgradeneeded = (event) => {
        const database = request.result;
        // Future migrations are appended by oldVersion; never recreate a populated store.
        if (event.oldVersion < 1) {
          for (const table of TABLES) {
            const store = database.createObjectStore(table, { keyPath: 'id' });
            if (['players', 'sessions', 'events', 'notes'].includes(table))
              store.createIndex('teamId', 'teamId');
            if (['events', 'notes'].includes(table)) {
              store.createIndex('playerId', 'playerId');
              store.createIndex('sessionId', 'sessionId');
            }
            if (table === 'events') {
              store.createIndex('timestamp', 'timestamp');
              store.createIndex('sessionSequence', ['sessionId', 'sequence'], { unique: true });
            }
          }
        }
        if (event.oldVersion < 2) database.createObjectStore('metadata', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.database = null;
        };
        resolve(request.result);
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Local storage could not be opened.'));
      request.onblocked = () =>
        reject(new Error('Close other Pinch Hitter tabs and try again to update local storage.'));
    });
  }

  private async migrateLegacyDatabaseIfPresent(): Promise<void> {
    if (!this.database) return;
    const alreadyEvaluated = await new Promise<boolean>((resolve) => {
      try {
        const tx = this.database!.transaction('metadata', 'readonly');
        const req = tx.objectStore('metadata').get('migratedFrom');
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
    if (alreadyEvaluated) return;

    const hasCurrentData = await new Promise<boolean>((resolve) => {
      try {
        const tx = this.database!.transaction(TABLES, 'readonly');
        let count = 0;
        for (const table of TABLES) {
          const req = tx.objectStore(table).count();
          req.onsuccess = () => {
            count += req.result;
          };
        }
        tx.oncomplete = () => resolve(count > 0);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });

    if (hasCurrentData) {
      await new Promise<void>((resolve) => {
        try {
          const tx = this.database!.transaction('metadata', 'readwrite');
          tx.objectStore('metadata').put({ id: 'migratedFrom', value: 'none-existing-data' });
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
      return;
    }

    const legacySnapshot = await this.readLegacyDatabase();
    if (legacySnapshot) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.database!.transaction([...TABLES, 'metadata'], 'readwrite');
        for (const table of TABLES) {
          const store = tx.objectStore(table);
          for (const item of legacySnapshot[table] || []) {
            store.put(item);
          }
        }
        tx.objectStore('metadata').put({
          id: 'migratedFrom',
          value: LEGACY_DATABASE_NAME,
          migratedAt: new Date().toISOString(),
        });
        tx.objectStore('metadata').put({ id: 'revision', value: crypto.randomUUID() });
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } else {
      await new Promise<void>((resolve) => {
        try {
          const tx = this.database!.transaction('metadata', 'readwrite');
          tx.objectStore('metadata').put({ id: 'migratedFrom', value: 'none-legacy-not-found' });
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  }

  private readLegacyDatabase(): Promise<DatabaseSnapshot | null> {
    return new Promise((resolve) => {
      let existed = true;
      const req = indexedDB.open(LEGACY_DATABASE_NAME);
      req.onupgradeneeded = (e) => {
        if (e.oldVersion === 0) {
          existed = false;
          req.transaction?.abort();
        }
      };
      req.onsuccess = () => {
        if (!existed) {
          req.result.close();
          try {
            indexedDB.deleteDatabase(LEGACY_DATABASE_NAME);
          } catch (err) {
            void err;
          }
          resolve(null);
          return;
        }
        const db = req.result;
        try {
          const storeNames = Array.from(db.objectStoreNames);
          const hasStores = TABLES.some((t) => storeNames.includes(t));
          if (!hasStores) {
            db.close();
            resolve(null);
            return;
          }
          const availableTables = TABLES.filter((t) => storeNames.includes(t));
          const tx = db.transaction(availableTables, 'readonly');
          const snapshot = {} as DatabaseSnapshot;
          for (const t of TABLES) {
            snapshot[t] = [];
          }
          let count = 0;
          for (const table of availableTables) {
            const r = tx.objectStore(table).getAll();
            r.onsuccess = () => {
              (snapshot[table] as DatabaseRecords[TableName][]) = r.result;
              count += r.result.length;
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(count > 0 ? snapshot : null);
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  async load(): Promise<DatabaseSnapshot> {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.database!.transaction([...TABLES, 'metadata'], 'readonly');
      const data = {} as DatabaseSnapshot;
      const revision = transaction.objectStore('metadata').get('revision');
      for (const table of TABLES) {
        const request = transaction.objectStore(table).getAll();
        request.onsuccess = () => {
          (data[table] as DatabaseRecords[TableName][]) = request.result;
        };
      }
      transaction.oncomplete = () => {
        this.revision = revision.result?.value ?? null;
        resolve(data);
      };
      transaction.onerror = transaction.onabort = () =>
        reject(transaction.error ?? new Error('Local data could not be read.'));
    });
  }

  async hasChanges(): Promise<boolean> {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.database!.transaction('metadata', 'readonly');
      const request = transaction.objectStore('metadata').get('revision');
      transaction.oncomplete = () => resolve((request.result?.value ?? null) !== this.revision);
      transaction.onerror = transaction.onabort = () =>
        reject(transaction.error ?? new Error('Local storage could not be checked.'));
    });
  }

  async apply(changes: DatabaseChange[], clear = false): Promise<void> {
    await this.open();
    const tables = clear ? TABLES : [...new Set(changes.map((change) => change.table))];
    if (!tables.length) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = this.database!.transaction([...tables, 'metadata'], 'readwrite');
      const revision = crypto.randomUUID();
      let conflict: ConcurrentWriteError | null = null;
      const check = transaction.objectStore('metadata').get('revision');
      check.onsuccess = () => {
        // Compare within this transaction too: browsers without Web Locks must never overwrite a stale queue.
        if ((check.result?.value ?? null) !== this.revision) {
          conflict = new ConcurrentWriteError();
          transaction.abort();
          return;
        }
        transaction.objectStore('metadata').put({ id: 'revision', value: revision });
        if (clear) for (const table of TABLES) transaction.objectStore(table).clear();
        for (const change of changes) {
          const store = transaction.objectStore(change.table);
          for (const id of change.delete ?? []) store.delete(id);
          for (const record of change.put ?? []) store.put(record);
        }
      };
      transaction.oncomplete = () => {
        this.revision = revision;
        resolve();
      };
      transaction.onerror = transaction.onabort = () =>
        reject(
          conflict ??
            transaction.error ??
            new Error('The change could not be saved. Your previous data is unchanged.'),
        );
    });
  }
  close(): void {
    this.database?.close();
    this.database = null;
  }
}
