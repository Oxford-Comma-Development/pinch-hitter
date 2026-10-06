import { expect, test } from '@playwright/test';
import { devUnlockCode, setupTeam } from '../e2e/helpers';

test('production builds reject dev-key codes and hide the tier simulator', async ({ page }) => {
  await setupTeam(page);

  await page.goto(`./activate#code=${await devUnlockCode()}`);
  await expect(page.getByRole('heading', { name: 'Activate Pro on this device' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('newer version of Pinch Hitter');
  await expect(page.getByRole('heading', { name: "You're Pro, Coach." })).toHaveCount(0);

  await page.goto('./settings');
  await expect(page.getByText('FREE COACH', { exact: true })).toBeVisible();
  await expect(page.getByText('Developer preview')).toHaveCount(0);
});
