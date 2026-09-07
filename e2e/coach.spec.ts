import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { setupTeam, startPractice, capture, readData, assertNoOverflow } from './helpers';
test('first practice, manual rounds, queue changes and interruption recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setupTeam(page);
  await assertNoOverflow(page);
  await page.getByRole('link', { name: 'Baseball Coach Helper home' }).click();
  await expect(page.getByRole('heading', { name: 'Westfield Wildcats' })).toBeVisible();
  await startPractice(page);
  await expect(page.locator('.queue-chip').first()).toContainText('Tyler');
  for (let i = 0; i < 5; i++) {
    await capture(page, 0.25 + i * 0.1, 0.25 + i * 0.04);
    if (i === 0) {
      await page.getByRole('button', { name: 'Line drive', exact: true }).click();
      await page.getByRole('button', { name: 'Single', exact: true }).click();
    }
  }
  await expect(page.locator('.current-hitter h1')).toHaveText('Marcus Williams');
  await expect(page.locator('.turn-count')).toContainText('5 this turn');
  const data = await readData(page);
  expect(data['events']).toHaveLength(5);
  expect(data['events'][0]).toMatchObject({ playerName: 'Marcus Williams' });
  expect(data['events'].filter((e: any) => e.contactType === 'line-drive')).toHaveLength(1);
  await page.getByRole('button', { name: 'LHP', exact: true }).click();
  await page.getByRole('button', { name: /Next batter/ }).click();
  await expect(page.locator('.current-hitter h1')).toHaveText('Tyler Davis');
  await page.getByRole('button', { name: 'Defer current hitter' }).click();
  await expect(page.locator('.current-hitter h1')).toHaveText('James Chen');
  await page.getByRole('button', { name: 'Manage batting queue' }).click();
  await page.getByRole('button', { name: 'Move Ethan Cole earlier', exact: true }).click();
  await page.getByRole('button', { name: 'Back to the field' }).click();
  await expect(page.locator('.queue-chip').first()).toContainText('Ethan');
  await capture(page, 0.6, 0.3);
  await page.getByRole('button', { name: /Undo last/ }).click();
  await expect.poll(async () => (await readData(page))['events'].length).toBe(5);
  await page.reload();
  await expect(page.locator('.current-hitter h1')).toHaveText('James Chen');
  await expect(page.locator('.queue-chip').first()).toContainText('Ethan');
  await expect(page.getByRole('button', { name: 'LHP', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await assertNoOverflow(page);
  const field = await page.locator('.field-area app-field svg').boundingBox();
  expect(field?.width).toBeGreaterThan(160);
  expect(field?.height).toBeGreaterThan(160);
  const next = await page.getByRole('button', { name: /Next batter/ }).boundingBox();
  expect(next!.y + next!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  expect(errors).toEqual([]);
});
test('automatic advance undo restores the hitter and persisted queue', async ({ page }) => {
  await setupTeam(page);
  await startPractice(page, '1');
  await capture(page);
  await expect(page.locator('.current-hitter h1')).toHaveText('Tyler Davis');
  await page.getByRole('button', { name: /Undo last/ }).click();
  await expect(page.locator('.current-hitter h1')).toHaveText('Marcus Williams');
  await expect(page.locator('.turn-count')).toContainText('0 / 1');
  expect((await readData(page))['events']).toHaveLength(0);
  await capture(page, 0.65, 0.28);
  await page.reload();
  await expect(page.locator('.current-hitter h1')).toHaveText('Tyler Davis');
  await page.getByRole('button', { name: /Undo last/ }).click();
  await expect(page.locator('.current-hitter h1')).toHaveText('Marcus Williams');
});
test('player review, filter, correction, file exports and clean-device restore', async ({
  page,
  browser,
}, testInfo) => {
  await setupTeam(page);
  await startPractice(page);
  await capture(page, 0.3, 0.3);
  await page.getByRole('button', { name: 'Line drive', exact: true }).click();
  await page.getByRole('button', { name: 'Single', exact: true }).click();
  await page.getByRole('button', { name: 'Add coaching note' }).click();
  await page.getByLabel('Attach note to').selectOption('event');
  await page.getByLabel('Coaching note', { exact: true }).fill('Keep the hands inside.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: 'LHP', exact: true }).click();
  await capture(page, 0.65, 0.32);
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Finish & review practice', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'See the whole field.' })).toBeVisible();
  const data = await readData(page);
  const marcus = (data['players'] as any[]).find((p) => p.name === 'Marcus Williams');
  await page.getByLabel('Report player').selectOption(marcus.id);
  await page.getByText('Refine report', { exact: false }).click();
  await page.getByLabel('Pitcher hand', { exact: true }).selectOption('L');
  await expect(page.locator('.summary-strip strong').first()).toHaveText('1');
  await page.getByLabel('Pitcher hand', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Heat', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.locator('.history-event').last().click();
  await page.getByRole('button', { name: /Edit observation/ }).click();
  await page.getByLabel('Observation notes').fill('Stayed through the middle.');
  await page.getByLabel('Result', { exact: true }).last().selectOption('double');
  await page.getByLabel(/Timestamped note/).fill('');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('dialog .error')).toBeVisible();
  expect(
    (await readData(page))['events'].some((e: any) => e.notes === 'Stayed through the middle.'),
  ).toBe(false);
  await page.getByLabel(/Timestamped note/).fill('Hands inside; strong contact.');
  const editField = page.locator('dialog app-field svg');
  await editField.click({ position: { x: 100, y: 100 } });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.reload();
  expect(
    (await readData(page))['events'].some(
      (e: any) => e.notes === 'Stayed through the middle.' && e.result === 'double',
    ),
  ).toBe(true);
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const csv = await csvDownload;
  const csvText = await readFile((await csv.path())!, 'utf8');
  expect(csvText).toContain('field_x');
  expect(csvText).toContain('Marcus Williams');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON backup' }).click();
  const backup = await backupDownload;
  const jsonText = await readFile((await backup.path())!, 'utf8');
  const parsed = JSON.parse(jsonText);
  expect(parsed.application).toBe('Baseball Coach Helper');
  expect(parsed.events).toHaveLength(2);
  expect(parsed.schemaVersion).toBe(1);
  const restored = await browser.newContext({ viewport: testInfo.project.use.viewport });
  const second = await restored.newPage();
  await second.goto(new URL('settings', testInfo.project.use.baseURL as string).href);
  await second.getByLabel('JSON backup', { exact: true }).setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(jsonText),
  });
  await expect(second.getByRole('heading', { name: 'Ready to merge' })).toBeVisible();
  await second.getByRole('button', { name: 'Merge backup' }).click();
  await expect(second.getByRole('status')).toContainText('Backup merged');
  expect((await readData(second))['events']).toHaveLength(2);
  await assertNoOverflow(second);
  await restored.close();
});
