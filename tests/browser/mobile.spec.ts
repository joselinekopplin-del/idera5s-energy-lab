import { test, expect } from '@playwright/test';
import { canvas, cameraDistance, distance, openLab, ready, state } from './helpers';

test('mobile layout, genuine touch orbit and two-finger pinch, low LOD and replay controls', async ({ page, context }, testInfo) => {
  await page.goto('./');
  await ready(page);
  expect((await state(page)).quality).toBe('low');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
  await canvas(page).scrollIntoViewIfNeeded();
  const rect = (await canvas(page).boundingBox())!;
  const x = rect.x + rect.width / 2, y = rect.y + rect.height * .5;
  const session = await context.newCDPSession(page);
  const before = await state(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 8; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 7, y: y + i * 2, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => distance((await state(page)).camera, before.camera)).toBeGreaterThan(.3);
  const orbit = await state(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 25, y, id: 1 }, { x: x + 25, y, id: 2 }] });
  for (let i = 1; i <= 8; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 25 - i * 6, y, id: 1 }, { x: x + 25 + i * 6, y, id: 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => cameraDistance(await state(page))).toBeLessThan(cameraDistance(orbit) - .2);
  await session.detach();
  await page.getByRole('button', { name: '风尚青', exact: true }).tap();
  await expect(page.getByRole('button', { name: '风尚青', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await openLab(page);
  await page.getByRole('button', { name: '播放回放', exact: true }).tap();
  await expect.poll(async () => Number(await page.getByRole('slider', { name: '回放时间', exact: true }).inputValue())).toBeGreaterThan(1);
  await page.getByRole('button', { name: '暂停回放', exact: true }).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
  await testInfo.attach('mobile-emulation-diagnostics', { body: JSON.stringify({ ...(await state(page)), note: '390x844 touch emulation on this desktop GPU; not a physical handset FPS measurement.' }, null, 2), contentType: 'application/json' });
});

test('reduced-motion preference disables automatic rotation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await ready(page);
  await page.getByRole('switch', { name: '自动旋转', exact: true }).tap();
  expect((await state(page)).auto).toBe(false);
  const before = (await state(page)).camera;
  await page.waitForTimeout(500);
  expect(distance((await state(page)).camera, before)).toBeLessThan(.001);
});
