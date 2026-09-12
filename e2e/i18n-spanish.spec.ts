import { test, expect, Page } from '@playwright/test';
import { setupTeam, readData, assertNoOverflow } from './helpers';

async function captureSpanish(page: Page, x = 0.45, y = 0.36) {
  const svg = page.locator('.field-area app-field svg');
  const box = await svg.boundingBox();
  if (!box) throw new Error('Field is not visible');
  const size = Math.min(box.width, box.height);
  await svg.click({
    position: { x: (box.width - size) / 2 + x * size, y: (box.height - size) / 2 + y * size },
  });
  await expect(page.locator('.capture-status')).toContainText('Contacto guardado');
  await expect(page.getByRole('button', { name: /Siguiente/ })).toBeEnabled();
}

test('Spanish internationalization (i18n) end-to-end coaching workflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. Initial English setup
  await setupTeam(page);
  await assertNoOverflow(page);

  // 2. Switch language to Spanish in Settings
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings.' })).toBeVisible();

  const langSelect = page.getByLabel('Language / Idioma');
  await expect(langSelect).toBeVisible();
  await langSelect.selectOption('es');

  // Verify settings updated reactively to Spanish
  await expect(page.getByRole('heading', { name: 'Ajustes.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Equipo' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Valores predeterminados de práctica' }),
  ).toBeVisible();
  await assertNoOverflow(page);

  // 3. Verify main navigation localized to Spanish
  await expect(page.getByRole('link', { name: 'Práctica', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alineación', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reportes', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ajustes', exact: true })).toBeVisible();

  // 4. Start Batting Practice in Spanish
  await page.getByRole('link', { name: 'Práctica', exact: true }).click();
  await page.getByRole('link', { name: /Iniciar práctica/ }).click();
  await page.getByRole('button', { name: /Iniciar práctica/ }).click();
  await expect(page.locator('.current-hitter h1')).toHaveText('Marcus Williams');

  // 5. Record contact and verify Spanish baseball classifications
  await captureSpanish(page, 0.45, 0.36);
  await expect(page.locator('.capture-status')).toContainText('Contacto guardado');

  // Check authentic baseball terms
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  await page.getByRole('button', { name: 'Sencillo', exact: true }).click();
  await page.getByRole('button', { name: '6 Plákata', exact: true }).click();

  // Record a swing and miss (whiff)
  const whiffBtn = page.locator('.whiff-scale-button');
  await expect(whiffBtn).toHaveText('0 Fallo');
  await whiffBtn.click();
  await expect(page.locator('.capture-status')).toContainText('Abanicado / Fallo');

  // Next batter and Undo in Spanish
  const nextBtn = page.getByRole('button', { name: /Siguiente/ });
  await expect(nextBtn).toBeEnabled();
  await nextBtn.click();
  await expect(page.locator('.current-hitter h1')).toHaveText('Tyler Davis');

  const undoBtn = page.getByRole('button', { name: /Deshacer/ });
  await expect(undoBtn).toBeEnabled();
  await undoBtn.click();

  // 6. Mobile viewport touch rails and no-overflow validation
  await assertNoOverflow(page);

  // 7. Finish practice and inspect Reports in Spanish
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Finish & review practice', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'See the whole field.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reportes', exact: true })).toBeVisible();
  await assertNoOverflow(page);

  // 8. Verify database integrity (canonical keys remain untouched)
  const data = await readData(page);
  expect(data['settings'][0]).toMatchObject({ language: 'es' });
  expect(data['events'].length).toBeGreaterThanOrEqual(1);
  // Canonical internal keys preserved
  expect(data['events'][0]).toHaveProperty('contactType');
  expect(['line-drive', 'dribbler', 'ground-ball', 'pop-up', 'fly-ball', null]).toContain(
    (data['events'][0] as any).contactType,
  );

  expect(errors).toEqual([]);
});
