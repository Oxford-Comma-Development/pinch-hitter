import { expect, test } from '@playwright/test';
import { assertNoOverflow, capture, setupTeam, startPractice } from './helpers';

test('coach colorblind shapes and player note edit/delete workflow', async ({ page }) => {
  // 1. Initial setup
  await setupTeam(page);

  // 2. Enable colorblind palette and shape markers in settings
  await page.goto('./settings');
  await page.getByText('Color-Blind Friendly (Okabe-Ito)').click();
  await expect(page.locator('input[value="colorblind"]')).toBeChecked();
  await page.waitForTimeout(300);

  // 3. Start practice and record contacts
  await page.goto('./practice');
  await page.getByRole('button', { name: 'Start practice', exact: false }).click();
  await capture(page, 0.5, 0.4);

  // Classify contact as Line drive
  await page.getByRole('button', { name: 'Line drive' }).click();

  // Next batter and record second contact
  await page.getByRole('button', { name: /Next batter/ }).click();
  await capture(page, 0.3, 0.6);
  await page.getByRole('button', { name: 'Ground ball' }).click();

  // Next batter and record third contact
  await page.getByRole('button', { name: /Next batter/ }).click();
  await capture(page, 0.7, 0.3);
  await page.getByRole('button', { name: 'Fly ball' }).click();

  // 4. Navigate to Reports
  await page.goto('./reports');

  // Verify chart legend classes match standard baseball idioms
  const legend = page.locator('.chart-legend.shapes-enabled');
  await expect(legend).toBeVisible();

  // Ground ball -> square, Dribbler -> square
  await expect(legend.locator('.legend-dot.ground-ball')).toHaveClass(/shape-square/);
  await expect(legend.locator('.legend-dot.dribbler')).toHaveClass(/shape-square/);

  // Line drive -> triangle
  await expect(legend.locator('.legend-dot.line-drive')).toHaveClass(/shape-triangle/);

  // Fly ball -> circle, Pop up -> circle
  await expect(legend.locator('.legend-dot.fly-ball')).toHaveClass(/shape-circle/);
  await expect(legend.locator('.legend-dot.pop-up')).toHaveClass(/shape-circle/);

  // Screenshot of spray chart and legend with baseball idiom shapes in classic theme
  await legend.scrollIntoViewIfNeeded();
  await page.locator('.report-field').screenshot({
    path: `test-results/screenshots/${test.info().project.name}-spray-legend.png`,
  });

  // 5. Player coaching notes: Add, Edit, Delete
  // Select Marcus Williams
  await page.getByLabel('Report player').selectOption({ label: '#12 · Marcus Williams' });
  await expect(page.locator('.notebook-card')).toBeVisible();

  // Add a coaching note
  await page
    .locator('textarea[name="coachingNote"]')
    .fill('Keep your hands back on offspeed pitches.');
  await page.getByRole('button', { name: 'Save note' }).click();

  // Note appears with Edit and Delete controls
  const noteArticle = page.locator('.notes-list article').first();
  await expect(noteArticle).toBeVisible();
  await expect(noteArticle.locator('p')).toHaveText('Keep your hands back on offspeed pitches.');
  const editBtn = noteArticle.getByRole('button', { name: 'Edit' });
  const deleteBtn = noteArticle.getByRole('button', { name: 'Delete' });
  await expect(editBtn).toBeVisible();
  await expect(deleteBtn).toBeVisible();

  // Screenshot note with Edit and Delete buttons
  await page.locator('.notebook-card').screenshot({
    path: `test-results/screenshots/${test.info().project.name}-note-view.png`,
  });

  // Edit the note
  await editBtn.click();
  const editInput = noteArticle.locator('textarea[name="editNoteText"]');
  await expect(editInput).toBeVisible();
  await expect(editInput).toHaveValue('Keep your hands back on offspeed pitches.');

  // Screenshot note in edit mode
  await page.locator('.notebook-card').screenshot({
    path: `test-results/screenshots/${test.info().project.name}-note-edit.png`,
  });

  await editInput.fill('Keep your hands back and drive through the ball.');
  await noteArticle.getByRole('button', { name: 'Save' }).click();

  // Verify updated note
  await expect(noteArticle.locator('p')).toHaveText(
    'Keep your hands back and drive through the ball.',
  );
  await expect(page.locator('.notice, [role="status"]')).toContainText('Coaching note updated.');

  // Test Delete: cancel first
  await deleteBtn.click();
  const deleteConfirm = noteArticle.locator('.note-delete-confirm');
  await expect(deleteConfirm).toBeVisible();

  // Screenshot note delete confirmation
  await page.locator('.notebook-card').screenshot({
    path: `test-results/screenshots/${test.info().project.name}-note-delete-confirm.png`,
  });

  await deleteConfirm.getByRole('button', { name: 'Keep note' }).click();
  await expect(deleteConfirm).not.toBeVisible();
  await expect(noteArticle.locator('p')).toHaveText(
    'Keep your hands back and drive through the ball.',
  );

  // Test Delete: confirm permanent deletion
  await deleteBtn.click();
  await expect(deleteConfirm).toBeVisible();
  await deleteConfirm.getByRole('button', { name: 'Delete permanently' }).click();

  // Verify note is gone
  await expect(page.locator('.notes-list article')).toHaveCount(0);
  await expect(page.locator('.notice, [role="status"]')).toContainText('Coaching note deleted.');

  // Switch to high contrast theme and verify visual rendering
  await page.goto('./settings');
  await page.getByText('High Contrast').click();
  await page.waitForTimeout(200);
  await page.goto('./reports');
  const hcLegend = page.locator('.chart-legend.shapes-enabled');
  await hcLegend.scrollIntoViewIfNeeded();
  await page.locator('.report-field').screenshot({
    path: `test-results/screenshots/${test.info().project.name}-high-contrast-spray.png`,
  });

  // Verify responsive layout
  await assertNoOverflow(page);
});
