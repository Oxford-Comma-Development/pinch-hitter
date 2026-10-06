import { expect, test } from '@playwright/test';
import { activatePro, assertNoOverflow, devUnlockCode, readData, setupTeam } from './helpers';

test('free coaches meet a respectful upgrade sheet and keep every existing team', async ({
  page,
}) => {
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

  // Before launch the checkout button says so and reveals the paste box; nothing breaks.
  await sheet.getByRole('button', { name: 'Continue to secure checkout' }).click();
  await expect(sheet.getByRole('alert')).toContainText('Checkout opens soon');
  await expect(sheet.getByLabel('Unlock code or link')).toBeVisible();

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

test('a Stripe return before checkout is configured explains and offers the paste box', async ({
  page,
}) => {
  await setupTeam(page);
  await page.goto('./activate?session_id=cs_test_a1B2c3D4e5F6g7H8');
  await expect(page.getByRole('heading', { name: 'Almost there' })).toBeVisible();
  await expect(page.getByLabel('Unlock code or link')).toBeVisible();
});
