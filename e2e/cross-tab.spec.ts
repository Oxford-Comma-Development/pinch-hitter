import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { setupTeam, startPractice, capture, readData } from './helpers';
test('an older tab exports fresh data and cannot attribute a contact to an unseen hitter', async ({
  page,
  context,
}, testInfo) => {
  await setupTeam(page);
  await startPractice(page);
  const other = await context.newPage();
  await other.goto(new URL('settings', testInfo.project.use.baseURL as string).href);
  await expect(other.getByRole('heading', { name: 'Settings.' })).toBeVisible();
  await capture(page, 0.35, 0.3);
  const downloaded = other.waitForEvent('download');
  await other.getByRole('button', { name: 'Download JSON backup' }).click();
  const file = await downloaded;
  const backup = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(backup.events).toHaveLength(1);
  await other.goto(new URL('practice', testInfo.project.use.baseURL as string).href);
  await expect(other.locator('.current-hitter h1')).toHaveText('Marcus Williams');
  await page.getByRole('button', { name: /Next batter/ }).click();
  await expect(page.locator('.current-hitter h1')).toHaveText('Tyler Davis');
  await other.locator('.field-area svg').click({ position: { x: 130, y: 130 } });
  await expect(other.locator('.current-hitter h1')).toHaveText('Tyler Davis');
  await expect(other.locator('.classification .error')).toContainText('another');
  expect((await readData(other))['events']).toHaveLength(1);
  await other.close();
});
