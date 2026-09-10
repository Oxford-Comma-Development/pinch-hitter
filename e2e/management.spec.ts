import { test, expect } from '@playwright/test';
import { setupTeam, readData, assertNoOverflow } from './helpers';
test('roster edits, archive/reactivate, team switching and invalid import preserve the notebook', async ({
  page,
}, testInfo) => {
  await setupTeam(page);
  await page.getByRole('button', { name: 'Edit Marcus Williams', exact: true }).click();
  await expect(page.getByLabel('Player name', { exact: true })).toBeFocused();
  await page.getByLabel('Bats', { exact: true }).selectOption('S');
  await page.getByLabel('Grade / year').fill('8');
  await page.getByLabel('SS', { exact: true }).check();
  await page.getByLabel('Coaching notes', { exact: true }).fill('Keep the front shoulder closed.');
  await page.getByRole('button', { name: 'Save player', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Marcus Williams', exact: true }).click();
  await page.getByRole('button', { name: 'Archive player', exact: true }).click();
  await expect(page.locator('.player-row')).toHaveCount(4);
  await page.getByLabel('Show archived').check();
  await page.getByRole('button', { name: 'Edit Marcus Williams', exact: true }).click();
  await page.getByRole('button', { name: 'Reactivate player', exact: true }).click();
  await expect(page.locator('.player-row')).toHaveCount(5);
  await page.getByRole('button', { name: 'Move Tyler Davis up', exact: true }).click();
  await expect(page.locator('.player-row').first()).toContainText('Tyler Davis');
  await page.screenshot({ path: testInfo.outputPath('roster.png'), fullPage: true });
  await page.getByRole('link', { name: 'Pinch Hitter home' }).click();
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await assertNoOverflow(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const original = (await readData(page))['teams'][0] as { id: string };
  await page.getByRole('button', { name: '+ Add team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('Summer Wildcats');
  await page.getByRole('button', { name: 'Save team', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Active team', { exact: true }).selectOption(original.id);
  await expect
    .poll(
      async () => ((await readData(page))['settings'][0] as { activeTeamId: string }).activeTeamId,
    )
    .toBe(original.id);
  await page.getByLabel('JSON backup', { exact: true }).setInputFiles({
    name: 'future.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 999, application: 'Pinch Hitter' })),
  });
  await expect(page.locator('.error[role=alert]')).toBeVisible();
  expect((await readData(page))['players']).toHaveLength(5);
  expect((await readData(page))['teams']).toHaveLength(2);
  await page.screenshot({ path: testInfo.outputPath('settings.png'), fullPage: true });
  await assertNoOverflow(page);
  await page.getByRole('link', { name: 'Roster', exact: true }).click();
  await expect(page.locator('.player-row')).toHaveCount(5);
  await expect(page.locator('.player-row').first()).toContainText('Tyler Davis');
});

test('privacy policy is publicly accessible and reachable from settings', async ({
  page,
}, testInfo) => {
  await page.goto('./privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy.' })).toBeVisible();
  await expect(page.getByText('100% On-Device')).toBeVisible();
  await expect(page.getByText('Zero Tracking')).toBeVisible();
  await assertNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('privacy.png'), fullPage: true });

  await page.getByRole('link', { name: '← Back to Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings.' })).toBeVisible();

  await page.getByRole('link', { name: 'Read our Privacy Policy →' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy Policy.' })).toBeVisible();
});
