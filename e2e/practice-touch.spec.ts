import { expect, test, Page } from '@playwright/test';
import { setupTeam, startPractice, readData, capture, assertNoOverflow } from './helpers';
import type { BallEvent, PracticeSession } from '../src/app/data/models';

async function activeSession(page: Page): Promise<PracticeSession> {
  return ((await readData(page))['sessions'] as PracticeSession[]).find(
    (session) => !session.endedAt,
  )!;
}

test('touch dragging reconciles the upcoming line without leaving practice', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    !testInfo.project.use.hasTouch,
    'Touch interaction runs on the touch-enabled viewport projects.',
  );
  await setupTeam(page);
  await startPractice(page);
  const before = (await activeSession(page)).queue;
  const handles = page.locator('.drag-handle');
  const from = await handles.nth(0).boundingBox();
  const to = await handles.nth(1).boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  const cdp = await context.newCDPSession(page);
  const point = { x: from!.x + from!.width / 2, y: from!.y + from!.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  for (let step = 1; step <= 6; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x + ((to!.x - from!.x) * step) / 6, y: point.y }],
    });
    // A real touch gesture spans several animation frames; allow DOM hit targets to move.
    await page.waitForTimeout(25);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const expected = [before[0], before[2], before[1], ...before.slice(3)];
  await expect.poll(async () => (await activeSession(page)).queue).toEqual(expected);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('.current-hitter h1')).toHaveText('Marcus Williams');
  await expect(page.locator('.queue-chip').first()).toContainText('James');
  await page.reload();
  await expect(page.locator('.queue-chip').first()).toContainText('James');
  expect((await activeSession(page)).queue).toEqual(expected);
});

test('orientation changes preserve the captured location and keep practice actions reachable', async ({
  page,
}) => {
  await setupTeam(page);
  await startPractice(page);
  const x = 0.31;
  const y = 0.42;
  await capture(page, x, y);
  await expect.poll(async () => (await readData(page))['events'].length).toBe(1);
  const original = ((await readData(page))['events'] as BallEvent[])[0];
  expect(original.fieldX).toBeCloseTo(x, 2);
  expect(original.fieldY).toBeCloseTo(y, 2);
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await assertNoOverflow(page);
    const field = page.locator('.field-area app-field svg');
    const dot = field.locator(`[data-event-id="${original.id}"] circle`).first();
    await expect(dot).toBeVisible();
    const fieldBox = (await field.boundingBox())!;
    const dotBox = (await dot.boundingBox())!;
    const size = Math.min(fieldBox.width, fieldBox.height);
    const dotX = (dotBox.x + dotBox.width / 2 - fieldBox.x - (fieldBox.width - size) / 2) / size;
    const dotY = (dotBox.y + dotBox.height / 2 - fieldBox.y - (fieldBox.height - size) / 2) / size;
    expect(dotX).toBeCloseTo(original.fieldX, 3);
    expect(dotY).toBeCloseTo(original.fieldY, 3);
    const actions = (await page.locator('.practice-actions').boundingBox())!;
    expect(actions.y + actions.height).toBeLessThanOrEqual(viewport.height + 1);
    const saved = ((await readData(page))['events'] as BallEvent[])[0];
    expect([saved.fieldX, saved.fieldY, saved.coordinateSystemVersion]).toEqual([
      original.fieldX,
      original.fieldY,
      1,
    ]);
  }
});
