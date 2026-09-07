import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transformSync } from 'esbuild';

// Use the real repository implementation in a real browser; no fake IndexedDB or new dependency.
const repositorySource = transformSync(
  readFileSync(resolve('src/app/data/repository.ts'), 'utf8'),
  { loader: 'ts', format: 'esm', target: 'es2022' },
).code;

test.beforeEach(async ({ page }) => {
  await page.route('**/repository-check', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Storage check</title>',
    }),
  );
  await page.goto('/repository-check');
});

test('IndexedDB migration preserves version 1 records and adds revision metadata', async ({
  page,
}) => {
  const result = await page.evaluate(async (source) => {
    const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const { CoachRepository } = await import(moduleUrl);
    URL.revokeObjectURL(moduleUrl);
    const name = `migration-${crypto.randomUUID()}`;
    const original = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        for (const table of ['teams', 'players', 'sessions', 'events', 'notes', 'settings'])
          request.result.createObjectStore(table, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = original.transaction('teams', 'readwrite');
      transaction
        .objectStore('teams')
        .put({ id: 'falcons', name: 'Falcons', notes: 'Saved before update' });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    original.close();
    const repository = new CoachRepository(name);
    const data = await repository.load();
    await repository.apply([
      { table: 'teams', put: [{ ...data.teams[0], notes: 'Still editable after update' }] },
    ]);
    const saved = await repository.load();
    repository.close();
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const version = upgraded.version;
    const metadataExists = upgraded.objectStoreNames.contains('metadata');
    upgraded.close();
    return {
      name: data.teams[0].name,
      originalNote: data.teams[0].notes,
      updatedNote: saved.teams[0].notes,
      version,
      metadataExists,
    };
  }, repositorySource);
  expect(result).toEqual({
    name: 'Falcons',
    originalNote: 'Saved before update',
    updatedNote: 'Still editable after update',
    version: 2,
    metadataExists: true,
  });
});

test('an event-index failure rolls back both event writes and the batting queue', async ({
  page,
}) => {
  const result = await page.evaluate(async (source) => {
    const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const { CoachRepository } = await import(moduleUrl);
    URL.revokeObjectURL(moduleUrl);
    const repository = new CoachRepository(`atomic-${crypto.randomUUID()}`);
    await repository.load();
    await repository.apply([
      { table: 'sessions', put: [{ id: 'practice', queue: ['marcus', 'tyler'], turnContacts: 0 }] },
    ]);
    let rejected = false;
    try {
      await repository.apply([
        {
          table: 'events',
          put: [
            { id: 'first', sessionId: 'practice', sequence: 1 },
            { id: 'duplicate', sessionId: 'practice', sequence: 1 },
          ],
        },
        {
          table: 'sessions',
          put: [{ id: 'practice', queue: ['tyler', 'marcus'], turnContacts: 0 }],
        },
      ]);
    } catch {
      rejected = true;
    }
    const data = await repository.load();
    repository.close();
    return { rejected, events: data.events.length, queue: data.sessions[0].queue };
  }, repositorySource);
  expect(result).toEqual({ rejected: true, events: 0, queue: ['marcus', 'tyler'] });
});

test('a stale writer cannot overwrite a newer queue and can retry after loading it', async ({
  page,
}) => {
  const result = await page.evaluate(async (source) => {
    const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const { CoachRepository, ConcurrentWriteError } = await import(moduleUrl);
    URL.revokeObjectURL(moduleUrl);
    const name = `concurrent-${crypto.randomUUID()}`;
    const first = new CoachRepository(name);
    const second = new CoachRepository(name);
    await first.load();
    await second.load();
    await first.apply([
      { table: 'sessions', put: [{ id: 'practice', queue: ['tyler', 'marcus'] }] },
    ]);
    let conflict = false;
    try {
      await second.apply([
        { table: 'sessions', put: [{ id: 'practice', queue: ['marcus', 'tyler'] }] },
      ]);
    } catch (error) {
      conflict = error instanceof ConcurrentWriteError;
    }
    const changed = await second.hasChanges();
    const current = await second.load();
    await second.apply([
      { table: 'sessions', put: [{ ...current.sessions[0], notes: 'Updated from second window' }] },
    ]);
    const result = await first.load();
    first.close();
    second.close();
    return { conflict, changed, queue: result.sessions[0].queue, notes: result.sessions[0].notes };
  }, repositorySource);
  expect(result).toEqual({
    conflict: true,
    changed: true,
    queue: ['tyler', 'marcus'],
    notes: 'Updated from second window',
  });
});
