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
export const DATABASE_NAME = 'baseball-coach-helper';
export const DATABASE_VERSION = 2;
const TABLES: TableName[] = ['teams', 'players', 'sessions', 'events', 'notes', 'settings'];

export class ConcurrentWriteError extends Error {
  constructor() {
    super('Another Coach Helper window changed this practice. Try the action again.');
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
        'This browser cannot open local storage. Open Coach Helper in a browser with IndexedDB enabled.',
      );
    this.database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
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
        reject(new Error('Close other Coach Helper tabs and try again to update local storage.'));
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
