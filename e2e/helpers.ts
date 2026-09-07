import { expect, Page } from '@playwright/test';
export async function setupTeam(page: Page) {
  await page.goto('./');
  await page.getByLabel('Team name', { exact: true }).fill('Westfield Wildcats');
  await page.getByRole('button', { name: 'Create team & add players' }).click();
  await page
    .getByLabel('Player list', { exact: true })
    .fill('Marcus Williams, 12\nTyler Davis, 7\nJames Chen, 24\nNoah Reed, 9\nEthan Cole, 3');
  await page.getByRole('button', { name: 'Preview players' }).click();
  await page.getByRole('button', { name: 'Add 5 players', exact: true }).click();
  await expect(page.locator('.player-row')).toHaveCount(5);
}
export async function startPractice(page: Page, rotation?: string) {
  await page.getByRole('link', { name: /Start Practice/ }).click();
  if (rotation) await page.getByLabel('Hitter rotation').selectOption(rotation);
  await page.getByRole('button', { name: 'Start practice', exact: false }).click();
  await expect(page.locator('.current-hitter h1')).toHaveText('Marcus Williams');
}
export async function capture(page: Page, x = 0.45, y = 0.36) {
  const svg = page.locator('.field-area app-field svg');
  const box = await svg.boundingBox();
  if (!box) throw new Error('Field is not visible');
  // SVG can be letterboxed. Derive the normalized square inside its viewport.
  const size = Math.min(box.width, box.height);
  await svg.click({
    position: { x: (box.width - size) / 2 + x * size, y: (box.height - size) / 2 + y * size },
  });
  await expect(page.locator('.capture-status')).toContainText('Contact saved');
  await expect(page.getByRole('button', { name: /Next batter/ })).toBeEnabled();
}
export async function readData(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('baseball-coach-helper');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const data: Record<string, unknown[]> = {};
    await Promise.all(
      ['teams', 'players', 'sessions', 'events', 'notes', 'settings'].map(
        (table) =>
          new Promise<void>((resolve, reject) => {
            const tx = db.transaction(table, 'readonly');
            const request = tx.objectStore(table).getAll();
            request.onsuccess = () => {
              data[table] = request.result;
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          }),
      ),
    );
    db.close();
    return data;
  });
}
export async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
