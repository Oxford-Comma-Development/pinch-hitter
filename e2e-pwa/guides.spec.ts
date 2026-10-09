import { test, expect } from '@playwright/test';
test('installed service worker lets static guides through instead of serving the app shell', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await page.goto('privacy');
  await page.getByRole('link', { name: 'Coaching guides' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coaching guides');
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('link', { name: /How to Read a Spray Chart/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How to Read a Spray Chart');
  await expect(page.getByText('Start with the count, not the picture')).toBeVisible();
  await expect(page.locator('app-root')).toHaveCount(0);
  // Without a trailing slash the host redirects so relative links still resolve.
  await page.goto('guides/softball-spray-charts');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Spray Charts for Softball');
  await page.getByRole('link', { name: 'Open Pinch Hitter' }).click();
  await expect(page.locator('app-root nav')).toBeVisible();
});
