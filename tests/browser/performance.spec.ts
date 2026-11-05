import { test, expect } from '@playwright/test';
import { openLab, ready, state } from './helpers';

// Recording and tracing add overhead and are intentionally disabled for measurements.
test.use({ video: 'off', trace: 'off' });

test('long saved-result playback records FPS and bounded GPU resources', async ({ page }, testInfo) => {
  test.skip(process.env.ENERGY_PERF !== '1', 'Run explicitly with ENERGY_PERF=1 for the 120-second measurement; no FPS target is fabricated.');
  test.setTimeout(180000);
  await page.goto('./');
  await ready(page);
  await openLab(page);
  await page.getByRole('combobox', { name: '驾驶工况', exact: true }).selectOption('longTrip');
  await expect(page.getByRole('button', { name: '播放回放', exact: true })).toBeEnabled({ timeout: 45000 });
  await page.getByRole('combobox', { name: '车身显示', exact: true }).selectOption('transparent');
  await page.getByRole('combobox', { name: '播放速度', exact: true }).selectOption('20');
  await page.getByRole('button', { name: '播放回放', exact: true }).click();
  await page.waitForTimeout(5000);
  const samples: any[] = [{ elapsed_s: 0, ...(await state(page)) }];
  for (let i = 1; i <= 12; i++) {
    await page.waitForTimeout(10000);
    samples.push({ elapsed_s: i * 10, ...(await state(page)) });
  }
  await page.getByRole('button', { name: '暂停回放', exact: true }).click();
  expect(samples.at(-1).geometries).toBe(samples[0].geometries);
  expect(samples.at(-1).textures).toBe(samples[0].textures);
  expect(samples.at(-1).programs).toBeLessThanOrEqual(samples[0].programs + 1);
  expect(samples.at(-1).sample.Time_s).toBeGreaterThan(2000);
  await testInfo.attach('long-playback-resource-observations', {
    body: JSON.stringify({ duration_s: 120, browser: await page.context().browser()?.version(), userAgent: await page.evaluate(() => navigator.userAgent), observations: samples,
      interpretation: 'FPS is browser rAF interval, not an independent GPU render-time measurement. JS heap may fluctuate with garbage collection. GPU resource counts are Three.js object counts, not VRAM bytes. This finite run can detect growth but cannot prove absence of all leaks.' }, null, 2), contentType: 'application/json',
  });
});
