import { test, expect } from '@playwright/test';
import { setupTeam, startPractice, capture, readData } from '../e2e/helpers';
test('production service worker opens and resumes a useful notebook offline', async ({
  page,
  context,
}) => {
  await setupTeam(page);
  await startPractice(page);
  await capture(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  const manifest = await page.evaluate(async () => {
    const url = document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href;
    return fetch(url).then((r) => r.json());
  });
  expect(manifest.name).toBe('Baseball Coach Helper');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.current-hitter h1')).toHaveText('Marcus Williams');
  await expect(page.locator('.turn-count')).toContainText('1 this turn');
  await capture(page, 0.7, 0.3);
  await expect.poll(async () => (await readData(page))['events'].length).toBe(2);
  await page.getByRole('button', { name: /Next batter/ }).click();
  await expect(page.locator('.current-hitter h1')).toHaveText('Tyler Davis');
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Finish & review practice' }).click();
  await expect(page.getByRole('heading', { name: 'See the whole field.' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole('link', { name: 'Roster', exact: true }).click();
  await expect(page.locator('.player-row')).toHaveCount(5);
});
