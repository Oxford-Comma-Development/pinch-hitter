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

test('defensive alignments compare coverage for a Pro coach, in English and Spanish', async ({
  page,
}, testInfo) => {
  await setupTeam(page);
  await page.getByRole('link', { name: 'Pinch Hitter home' }).click();
  await startPractice(page);
  // Grounders through the left side and one up the middle, each classified.
  // Spread out: a tap on an existing mark selects it rather than recording a new contact.
  for (const [x, y] of [
    [0.34, 0.64],
    [0.41, 0.59],
    [0.35, 0.54],
    [0.5, 0.52],
  ]) {
    await capture(page, x, y);
    const groundBall = page.getByRole('button', { name: 'Ground ball', exact: true });
    // A new contact starts unclassified (nothing carries over); wait for it before tapping.
    await expect(groundBall).toHaveAttribute('aria-pressed', 'false');
    await groundBall.click();
    await expect(groundBall).toHaveAttribute('aria-pressed', 'true');
  }
  // Let the last classification finish saving before a full page load.
  await expect
    .poll(
      async () =>
        ((await readData(page))['events'] as { contactType: string | null }[]).filter(
          (e) => e.contactType === 'ground-ball',
        ).length,
    )
    .toBe(4);
  await activatePro(page);
  await page.goto('./reports');

  const card = page.locator('app-pro-analytics');
  await card.getByRole('button', { name: 'Defense', exact: true }).click();
  await expect(card.getByRole('heading', { name: 'Defensive alignment' })).toBeVisible();
  const table = card.locator('table.coverage-table');
  await expect(table.getByRole('row')).toHaveCount(6);
  await expect(table.getByRole('row', { name: /Standard/ })).toContainText('of 4');
  await expect(table).toContainText('★ Best');
  await card.getByRole('radio', { name: 'Pull shift' }).click();
  await expect(card.getByRole('radio', { name: 'Pull shift' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(card.locator('app-field .defense-zones circle')).toHaveCount(8);
  await assertNoOverflow(page);
  await card.screenshot({ path: testInfo.outputPath('defense.png') });

  await page.goto('./settings');
  await page.getByLabel('Language / Idioma').selectOption('es');
  // Wait for the saved setting before leaving, or the reload can race the write.
  await expect(page.getByRole('heading', { name: 'Ajustes.' })).toBeVisible();
  await page.goto('./reports');
  await card.getByRole('button', { name: 'Defensa', exact: true }).click();
  await expect(card.getByRole('heading', { name: 'Alineación defensiva' })).toBeVisible();
  await expect(card.locator('table.coverage-table')).toContainText('Rodados');
  await expect(card.locator('table.coverage-table')).toContainText('de 4');
  await card.getByRole('button', { name: 'Comparar', exact: true }).click();
  // One hitter on the team: the Spanish empty state, not template source.
  await expect(card).toContainText('Registra contactos de al menos dos bateadores');
  await expect(page.locator('app-pro-analytics')).not.toContainText('{{');
  await card.screenshot({ path: testInfo.outputPath('compare-es.png') });
});
