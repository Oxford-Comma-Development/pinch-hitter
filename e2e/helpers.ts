import { expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeUnlockCode } from '../src/app/data/license';
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
      const request = indexedDB.open('pinch-hitter');
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

/**
 * Mints an unlock code with the dev-only key (trusted by `npm start` builds, never production)
 * and activates it through the real `/activate#code=` link flow.
 */
export async function devUnlockCode(name = 'Coach Dana R.'): Promise<string> {
  const jwk = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'dev.private.jwk'), 'utf8'));
  delete jwk.kid;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']);
  return encodeUnlockCode(
    { v: 1, kid: 'dev', lic: 'comp-e2e', tier: 'pro', name, iat: 1_791_000_000 },
    key,
  );
}
export async function activatePro(page: Page, name?: string) {
  await page.goto(`./activate#code=${await devUnlockCode(name)}`);
  await expect(page.getByRole('heading', { name: "You're Pro, Coach." })).toBeVisible();
}

/**
 * Stands in for the license function and Stripe's hosted page so tests never touch live Stripe.
 * `/checkout` answers with a fake Stripe URL that immediately "pays" and redirects back to
 * `/activate?session_id=…`; `/activate` answers with a dev-signed code (or the given status).
 */
export async function mockLicenseService(
  page: Page,
  options: { checkoutStatus?: number; activateStatus?: number; name?: string } = {},
) {
  const requests: { path: string; body: unknown }[] = [];
  const sessionId = 'cs_test_e2eMockSession123';
  await page.route(/pinch-hitter-license-.*\.run\.app\/(checkout|activate)$/, async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push({ path, body: route.request().postDataJSON() });
    const status = path === '/checkout' ? options.checkoutStatus : options.activateStatus;
    if (status && status !== 200) {
      await route.fulfill({ status, json: { error: 'mocked' } });
    } else if (path === '/checkout') {
      await route.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/mock' } });
    } else {
      await route.fulfill({ json: { code: await devUnlockCode(options.name) } });
    }
  });
  await page.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<script>location.replace('http://127.0.0.1:4200/activate?session_id=${sessionId}')</script>`,
    }),
  );
  return requests;
}
