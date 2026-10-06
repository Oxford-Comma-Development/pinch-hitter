import { expect, test } from '@playwright/test';
import {
  activatePro,
  assertNoOverflow,
  devUnlockCode,
  mockLicenseService,
  readData,
  setupTeam,
} from './helpers';

test('free coaches meet a respectful upgrade sheet and keep every existing team', async ({
  page,
}) => {
  await mockLicenseService(page, { checkoutStatus: 503 });
  await setupTeam(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('FREE COACH', { exact: true })).toBeVisible();

  // A second team is Pro: the button explains instead of failing.
  await page.getByRole('button', { name: /\+ Add team/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Go deeper than the cage.' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('This unlocks')).toBeVisible();
  await expect(sheet.getByText('Unlimited teams & seasons').first()).toBeVisible();
  await assertNoOverflow(page);

  // If the license service is unreachable, the coach is told plainly that nothing was charged.
  await expect(sheet).toContainText('$39');
  await sheet.getByRole('button', { name: 'Continue to secure checkout' }).click();
  await expect(sheet.getByRole('alert')).toContainText('Nothing was charged');

  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  expect((await readData(page))['teams']).toHaveLength(1);
});

test('pasting a code or link unlocks Pro immediately and it survives a reload', async ({
  page,
}) => {
  await setupTeam(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Unlock Pro/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByText('Already have an unlock code?').click();

  await sheet.getByLabel('Unlock code or link').fill('hello coach');
  await sheet.getByRole('button', { name: 'Activate Pro' }).click();
  await expect(sheet.getByRole('alert')).toContainText("doesn't look like an unlock code");

  const code = await devUnlockCode('Coach Rivera');
  await sheet
    .getByLabel('Unlock code or link')
    .fill(`Open this link:\nhttps://example.test/activate#code=${code}\nThanks!`);
  await sheet.getByRole('button', { name: 'Activate Pro' }).click();
  await expect(sheet.getByRole('heading', { name: "You're Pro, Coach." })).toBeVisible();
  await sheet.getByRole('button', { name: 'Back to coaching' }).click();

  await page.reload();
  await expect(page.getByText('Licensed to Coach Rivera')).toBeVisible();
  await expect(page.getByText('✦ PRO COACH')).toBeVisible();

  // The license never travels inside notebook data or backups.
  expect(JSON.stringify(await readData(page))).not.toContain('PH1.');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove Pro from this device' }).click();
  await expect(page.getByText('FREE COACH', { exact: true })).toBeVisible();
});

test('activation links land on a celebration with ways to keep the code', async ({ page }) => {
  await setupTeam(page);
  await activatePro(page, 'Coach Dana R.');
  await expect(page.getByText('Licensed to Coach Dana R.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy unlock link' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Email it to myself' })).toHaveAttribute(
    'href',
    /^mailto:\?subject=/,
  );
  await assertNoOverflow(page);
});

test('buying Pro: sheet to Stripe and back to an unlocked app with no typing', async ({ page }) => {
  const requests = await mockLicenseService(page, { name: 'Coach Rivera' });
  await setupTeam(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Unlock Pro/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Continue to secure checkout' })
    .click();

  await expect(page.getByRole('heading', { name: "You're Pro, Coach." })).toBeVisible();
  await expect(page.getByText('Licensed to Coach Rivera')).toBeVisible();
  expect(requests.map((r) => r.path)).toEqual(['/checkout', '/activate']);
  expect(requests[0].body).toEqual({ appUrl: 'http://127.0.0.1:4200/' });
  expect(requests[1].body).toEqual({ sessionId: 'cs_test_e2eMockSession123' });
});

test('a Stripe return the service cannot confirm explains and offers the paste box', async ({
  page,
}) => {
  await mockLicenseService(page, { activateStatus: 402 });
  await setupTeam(page);
  await page.goto('./activate?session_id=cs_test_a1B2c3D4e5F6g7H8');
  await expect(page.getByRole('heading', { name: 'Almost there' })).toBeVisible();
  await expect(page.getByText("Stripe hasn't confirmed this payment yet")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByLabel('Unlock code or link')).toBeVisible();
});
