import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  activatePro,
  assertNoOverflow,
  capture,
  readData,
  setupTeam,
  startPractice,
} from './helpers';

async function recordTwoHitters(page: import('@playwright/test').Page) {
  await setupTeam(page);
  await page.getByRole('link', { name: 'Pinch Hitter home' }).click();
  await startPractice(page);
  for (let i = 0; i < 3; i++) await capture(page, 0.3 + i * 0.05, 0.35);
  await page.getByRole('button', { name: /Next batter/ }).click();
  for (let i = 0; i < 3; i++) await capture(page, 0.65 + i * 0.05, 0.4);
}

test('free coaches preview Pro analysis on sample data, never their own', async ({
  page,
}, testInfo) => {
  await recordTwoHitters(page);
  await page.goto('./reports');

  const card = page.locator('app-pro-analytics');
  await expect(card.getByText('Sample data')).toBeVisible();
  await expect(card.locator('table.compare-table thead')).toContainText('Sample Hitter A');
  await expect(card.locator('table.compare-table')).not.toContainText('Marcus Williams');
  await expect(card.getByLabel('Hitter A')).toBeDisabled();
  await card.screenshot({ path: testInfo.outputPath('compare-preview.png') });

  await card.getByRole('button', { name: 'Trends', exact: true }).click();
  await expect(card.locator('svg.trend-chart')).toBeVisible();
  await card.screenshot({ path: testInfo.outputPath('trends-preview.png') });

  await card.getByRole('button', { name: 'Unlock Pro Coach →' }).click();
  await expect(page.getByRole('dialog').getByText('This unlocks')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText('Development trend curves').first(),
  ).toBeVisible();
  await assertNoOverflow(page);
});

test('Pro coaches compare their own hitters with explicit denominators', async ({
  page,
}, testInfo) => {
  await recordTwoHitters(page);
  await activatePro(page);
  await page.goto('./reports');

  const card = page.locator('app-pro-analytics');
  await expect(card.getByText('Sample data')).toHaveCount(0);
  await expect(card.getByLabel('Hitter A')).toBeEnabled();
  const table = card.locator('table.compare-table');
  await expect(table.locator('thead')).toContainText('Marcus Williams');
  await expect(table.locator('thead')).toContainText('Tyler Davis');
  await expect(table.getByRole('row', { name: /Recorded contacts/ })).toContainText('3');
  await card.screenshot({ path: testInfo.outputPath('compare-pro.png') });
  await assertNoOverflow(page);
});

test('scout cards and enriched CSV columns are Pro, and work once unlocked', async ({
  page,
}, testInfo) => {
  await recordTwoHitters(page);
  const players = (await readData(page))['players'] as { id: string; name: string }[];
  const marcus = players.find((p) => p.name === 'Marcus Williams')!;

  await page.goto(`./reports?player=${marcus.id}`);
  await page.getByRole('button', { name: /Scout card/ }).click();
  await expect(page.getByRole('dialog').getByText('This unlocks')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Scout cards').first()).toBeVisible();
  await page.keyboard.press('Escape');

  const freeCsv = await downloadCsv(page);
  expect(freeCsv.split('\r\n')[0]).not.toContain('distance_ft_estimated');

  await activatePro(page);
  await page.goto(`./reports?player=${marcus.id}`);
  const proCsv = await downloadCsv(page);
  expect(proCsv.split('\r\n')[0]).toContain('distance_ft_estimated,spray_angle_deg');

  await page.getByRole('button', { name: /Scout card/ }).click();
  await expect(page).toHaveURL(new RegExp(`/scout/${marcus.id}$`));
  const card = page.getByRole('article', { name: 'Scout card' });
  await expect(card.getByRole('heading', { name: /Marcus Williams/ })).toBeVisible();
  await expect(card).toContainText('Recorded contacts');
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeVisible();
  await assertNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('scout-card.png'), fullPage: true });
});

async function downloadCsv(page: import('@playwright/test').Page): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download CSV' }).click(),
  ]);
  const path = await download.path();
  return readFileSync(path!, 'utf8');
}
