import { test, expect, devices } from '@playwright/test';
import { setupTeam, startPractice, capture, readData, assertNoOverflow } from './helpers';

test.describe('Take Your Notebook With You: Mobile Transfers', () => {
  test('iPhone -> iCloud Drive -> second iPad/iPhone transfer', async ({ browser, baseURL }) => {
    // 1. Device 1: iPhone Safari running on iOS with simulated native file sharing (iCloud Drive / Files)
    const iphoneContext = await browser.newContext({
      ...devices['iPhone 14'],
      baseURL,
    });

    await iphoneContext.addInitScript(() => {
      (
        window as unknown as {
          mockICloudDrive: Array<{ name: string; type: string; text: string }>;
        }
      ).mockICloudDrive = [];
      navigator.canShare = (data?: { files?: File[] }) =>
        Boolean(data && data.files && data.files.length > 0);
      navigator.share = async (data?: { files?: File[]; title?: string }) => {
        if (data?.files && data.files.length > 0) {
          for (const file of data.files) {
            const text = await file.text();
            (
              window as unknown as {
                mockICloudDrive: Array<{ name: string; type: string; text: string }>;
              }
            ).mockICloudDrive.push({
              name: file.name,
              type: file.type,
              text,
            });
          }
          return Promise.resolve();
        }
        return Promise.reject(new Error('Share canceled'));
      };
    });

    const iphonePage = await iphoneContext.newPage();
    await setupTeam(iphonePage);
    await startPractice(iphonePage);
    await capture(iphonePage, 0.45, 0.35);

    await capture(iphonePage, 0.65, 0.25);

    // Finish practice session
    await iphonePage.getByRole('button', { name: 'Finish', exact: true }).click();
    await iphonePage.getByRole('button', { name: 'Finish & review practice', exact: true }).click();
    await expect(iphonePage.getByRole('heading', { name: 'See the whole field.' })).toBeVisible();

    // Navigate to Settings
    await iphonePage.getByRole('link', { name: 'Settings' }).click();

    // Verify philosophy statement & cross-platform PWA messaging
    await expect(iphonePage.locator('.philosophy-quote')).toContainText(
      "Pinch Hitter doesn't keep your data on our servers",
    );
    await expect(
      iphonePage
        .getByText(
          'Works on iPhone, iPad, Android, Windows, Mac, and Chromebook. No app store required.',
        )
        .first(),
    ).toBeVisible();

    // Verify polite unbacked indicator is present
    await expect(iphonePage.locator('.backup-status-pill')).toContainText('Backup recommended');

    // On mobile with file share support, native share is the primary button
    const shareBtn = iphonePage.getByRole('button', { name: 'Save or share notebook' });
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Verify successful save message & status update
    await expect(iphonePage.getByRole('status')).toContainText(
      'Notebook saved. Your data is with you.',
    );
    await expect(iphonePage.locator('.backup-status-pill')).toContainText('Notebook backed up');

    // Retrieve file saved to simulated iCloud Drive
    const driveFiles = await iphonePage.evaluate(
      () =>
        (
          window as unknown as {
            mockICloudDrive: Array<{ name: string; type: string; text: string }>;
          }
        ).mockICloudDrive,
    );
    expect(driveFiles.length).toBeGreaterThanOrEqual(1);
    const icloudFile = driveFiles[0];
    expect(icloudFile.name).toMatch(/^pinch-hitter-\d{4}-\d{2}-\d{2}\.json$/);

    const parsed = JSON.parse(icloudFile.text);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.application).toBe('Pinch Hitter');
    expect(parsed.teams[0].name).toBe('Westfield Wildcats');
    expect(parsed.players).toHaveLength(5);
    expect(parsed.events).toHaveLength(2);

    await assertNoOverflow(iphonePage);

    // 2. Device 2: iPad opening Pinch Hitter for the first time
    const ipadContext = await browser.newContext({
      ...devices['iPad (gen 7)'],
      baseURL,
    });
    const ipadPage = await ipadContext.newPage();
    await ipadPage.goto('./');

    // Receiving-device flow is extremely obvious on the welcome screen
    await expect(ipadPage.locator('.receive-card')).toBeVisible();
    await expect(ipadPage.getByRole('heading', { name: 'Bring your notebook over' })).toBeVisible();
    await expect(
      ipadPage
        .getByText(
          'Works on iPhone, iPad, Android, Windows, Mac, and Chromebook. No app store required.',
        )
        .first(),
    ).toBeVisible();

    // Select the file from iCloud Drive directly on the welcome screen
    await ipadPage.getByLabel('Choose notebook file to import').setInputFiles({
      name: icloudFile.name,
      mimeType: 'application/json',
      buffer: Buffer.from(icloudFile.text),
    });

    // Preview shows all incoming counts
    await expect(ipadPage.locator('.welcome-preview-box')).toBeVisible();
    await expect(ipadPage.locator('.welcome-preview-box')).toContainText('1 teams');
    await expect(ipadPage.locator('.welcome-preview-box')).toContainText('5 players');
    await expect(ipadPage.locator('.welcome-preview-box')).toContainText('2 contacts');

    // Click "Open notebook on this device"
    await ipadPage.getByRole('button', { name: 'Open notebook on this device' }).click();

    // Coach is now directly in their active season on the iPad!
    await expect(ipadPage.getByRole('heading', { name: 'Westfield Wildcats' })).toBeVisible();
    await expect(ipadPage.getByText('5 active players')).toBeVisible();
    await expect(ipadPage.getByText('2 recorded contacts')).toBeVisible();

    // Check Reports on iPad
    await ipadPage.getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(ipadPage.locator('.count-pill')).toContainText('2 contacts');
    await assertNoOverflow(ipadPage);

    await iphoneContext.close();
    await ipadContext.close();
  });

  test('Android -> Google Drive -> second Android transfer with non-destructive merge', async ({
    browser,
    baseURL,
  }) => {
    // 1. Device 1: Android Pixel 7 simulating native share to Google Drive
    const androidContext = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL,
    });

    await androidContext.addInitScript(() => {
      (
        window as unknown as {
          mockGoogleDrive: Array<{ name: string; type: string; text: string }>;
        }
      ).mockGoogleDrive = [];
      navigator.canShare = (data?: { files?: File[] }) =>
        Boolean(data && data.files && data.files.length > 0);
      navigator.share = async (data?: { files?: File[]; title?: string }) => {
        if (data?.files && data.files.length > 0) {
          for (const file of data.files) {
            const text = await file.text();
            (
              window as unknown as {
                mockGoogleDrive: Array<{ name: string; type: string; text: string }>;
              }
            ).mockGoogleDrive.push({
              name: file.name,
              type: file.type,
              text,
            });
          }
          return Promise.resolve();
        }
        return Promise.reject(new Error('Share canceled'));
      };
    });

    const androidPage = await androidContext.newPage();
    await setupTeam(androidPage);
    await startPractice(androidPage);
    await capture(androidPage, 0.4, 0.4);
    await capture(androidPage, 0.6, 0.3);
    await capture(androidPage, 0.5, 0.2);

    // Finish practice session
    await androidPage.getByRole('button', { name: 'Finish', exact: true }).click();
    await androidPage
      .getByRole('button', { name: 'Finish & review practice', exact: true })
      .click();
    await expect(androidPage.getByRole('heading', { name: 'See the whole field.' })).toBeVisible();

    // Return to Practice/Home tab
    await androidPage.getByRole('link', { name: 'Practice', exact: true }).click();

    // Polite unbacked flag is visible on the Home coach card
    await expect(androidPage.locator('.unbacked-flag')).toBeVisible();
    await expect(androidPage.locator('.unbacked-flag')).toContainText('Backup recommended');
    await expect(androidPage.locator('.philosophy-blurb')).toContainText(
      "Pinch Hitter doesn't keep your data on our servers",
    );

    // Tap "Take notebook with you →"
    await androidPage.getByRole('link', { name: 'Take notebook with you →' }).click();

    // In Settings, primary action is native share sheet ("Save to Drive")
    await androidPage.getByRole('button', { name: 'Save or share notebook' }).click();
    await expect(androidPage.getByRole('status')).toContainText('Notebook saved');

    // Retrieve file saved to Google Drive
    const driveFiles = await androidPage.evaluate(
      () =>
        (
          window as unknown as {
            mockGoogleDrive: Array<{ name: string; type: string; text: string }>;
          }
        ).mockGoogleDrive,
    );
    expect(driveFiles.length).toBeGreaterThanOrEqual(1);
    const gdriveFile = driveFiles[0];

    // 2. Device 2: Second Android phone with existing local data (testing merge semantics)
    const secondAndroidContext = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL,
    });
    const secondAndroidPage = await secondAndroidContext.newPage();
    await secondAndroidPage.goto('./');

    // Create a different local team on Device 2: "Round Rock Express"
    await secondAndroidPage.getByLabel('Team name', { exact: true }).fill('Round Rock Express');
    await secondAndroidPage.getByRole('button', { name: 'Create team & add players' }).click();
    await secondAndroidPage
      .getByLabel('Player list', { exact: true })
      .fill('Sammy Sosa, 21\nMark McGwire, 25');
    await secondAndroidPage.getByRole('button', { name: 'Preview players' }).click();
    await secondAndroidPage.getByRole('button', { name: 'Add 2 players', exact: true }).click();
    await expect(secondAndroidPage.locator('.player-row')).toHaveCount(2);

    // Go to Settings -> Open notebook on this device (Import)
    await secondAndroidPage.getByRole('link', { name: 'Settings' }).click();
    await secondAndroidPage.getByLabel('JSON backup', { exact: true }).setInputFiles({
      name: gdriveFile.name,
      mimeType: 'application/json',
      buffer: Buffer.from(gdriveFile.text),
    });

    // Preview appears
    await expect(secondAndroidPage.getByRole('heading', { name: 'Ready to merge' })).toBeVisible();
    await secondAndroidPage.getByRole('button', { name: 'Merge backup' }).click();
    await expect(secondAndroidPage.getByRole('status')).toContainText('Backup merged');

    // Verify non-destructive merge semantics:
    // Both teams exist, total of 7 players (5 from Wildcats + 2 from Round Rock)
    const secondData = await readData(secondAndroidPage);
    expect(secondData['teams']).toHaveLength(2);
    expect(secondData['players']).toHaveLength(7);
    expect(secondData['events']).toHaveLength(3);

    await assertNoOverflow(secondAndroidPage);

    await androidContext.close();
    await secondAndroidContext.close();
  });
});
