import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { openLab, ready, state } from './helpers';

const fixture = JSON.parse(await readFile(new URL('../../public/data/braking_Rule_Based.json', import.meta.url), 'utf8'));
const column = (name: string) => fixture.fields.indexOf(name);
const chargingIndex = fixture.rows.findIndex((row: number[], i: number) => i > 0 && row[column('ModeCode')] === 4 && row[column('Motor_W')] < -100 && row[column('Engine_W')] > 100);
const chargingTime = fixture.rows[chargingIndex][column('Time_s')];

const valueInDialog = (page: Page, label: string) => page.getByRole('dialog').locator('.part-values > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd');
const closeDialog = (page: Page) => page.getByRole('button', { name: '知道了', exact: true }).click();

async function seekByKeyboard(page: Page, seconds: number) {
  const slider = page.getByRole('slider', { name: '回放时间', exact: true });
  await slider.focus();
  await slider.press('Home');
  // Native range-keyboard input, not a DOM value assignment or a scene method call.
  for (let i = 0; i < seconds; i++) await slider.press('ArrowRight');
  await expect(slider).toHaveValue(String(seconds));
  await expect.poll(async () => (await state(page)).sample.Time_s).toBe(seconds);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await ready(page);
  await openLab(page);
});

test('paused nonzero reference distance preserves all wheel angles across all LOD replacements', async ({ page }) => {
  await page.getByRole('combobox', { name: '驾驶工况', exact: true }).selectOption('braking');
  await expect(page.getByRole('button', { name: '播放回放', exact: true })).toBeEnabled();
  await seekByKeyboard(page, 30);
  const before = await state(page);
  expect(before.sample.Distance_km).toBeGreaterThan(.1);
  const expectedAngle = -before.sample.Distance_km * 1000 / .33965;
  expect(before.wheels).toHaveLength(4);
  before.wheels.forEach((angle: number) => expect(angle).toBeCloseTo(expectedAngle, 8));
  await page.locator('.visual-options > summary').click();
  for (const quality of ['high', 'low', 'standard']) {
    const previousTriangles = (await state(page)).triangles;
    await page.getByRole('combobox', { name: '画质', exact: true }).selectOption(quality);
    await expect.poll(async () => (await state(page)).triangles).not.toBe(previousTriangles);
    const after = await state(page);
    expect(after.sample.Time_s).toBe(30);
    expect(after.sample.Distance_km).toBe(before.sample.Distance_km);
    expect(after.wheels).toHaveLength(4);
    after.wheels.forEach((angle: number) => expect(angle).toBeCloseTo(expectedAngle, 8));
    await expect(page.getByRole('button', { name: '播放回放', exact: true })).toBeVisible();
  }
});

test('zero-power motor is standby, stopped-engine ratio is unavailable, and DC-bus guidance is explicit', async ({ page }) => {
  const saved = await state(page);
  expect(saved.sample.Motor_W).toBe(0);
  expect(saved.sample.EngineRPM).toBe(0);
  expect(saved.sample.Fuel_W).toBe(0);
  await page.getByRole('button', { name: '驱动电机', exact: true }).click();
  await expect(valueInDialog(page, '当前状态')).toHaveText('待机');
  await closeDialog(page);
  await page.getByRole('button', { name: '发动机', exact: true }).click();
  await expect(valueInDialog(page, '输出 / 燃油化学功率')).toHaveText('—（停机）');
  await expect(valueInDialog(page, '采样燃油流量')).toHaveText('0.00 L/h');
  await closeDialog(page);
  await page.getByRole('button', { name: '动力电池', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('直流母线示意');
  await expect(page.getByRole('dialog')).toContainText('反向发电可能同时供给辅助负载');
  await expect(page.getByRole('dialog')).toContainText('电池是否净充电请看电池功率的正负');
});

test('engine charging is distinguished from braking and sampled fuel flow matches immutable saved volumes', async ({ page }) => {
  expect(chargingIndex).toBeGreaterThan(0);
  await page.getByRole('combobox', { name: '驾驶工况', exact: true }).selectOption('braking');
  await page.getByRole('combobox', { name: '能量管理策略', exact: true }).selectOption('Rule_Based');
  await expect(page.getByRole('button', { name: '播放回放', exact: true })).toBeEnabled();
  await expect(page.locator('.data-provenance')).toContainText('braking_Rule_Based');
  await seekByKeyboard(page, chargingTime);
  const saved = fixture.rows[chargingIndex], previous = fixture.rows[chargingIndex - 1];
  const expectedFuelRate = (saved[column('FuelUsed_L')] - previous[column('FuelUsed_L')]) / (saved[column('Time_s')] - previous[column('Time_s')]) * 3600;
  const rendered = await state(page);
  expect(rendered.sample.ModeCode).toBe(4);
  expect(rendered.sample.Motor_W).toBe(saved[column('Motor_W')]);
  expect(rendered.sample.FuelRate_Lh).toBeCloseTo(expectedFuelRate, 10);
  expect(expectedFuelRate).toBeGreaterThan(0);
  await page.getByRole('button', { name: '驱动电机', exact: true }).click();
  await expect(valueInDialog(page, '当前状态')).toHaveText('发电 / 发动机充电');
  await expect(valueInDialog(page, '当前状态')).not.toContainText('制动回收');
  await closeDialog(page);
  await page.getByRole('button', { name: '发动机', exact: true }).click();
  await expect(valueInDialog(page, '采样燃油流量')).toHaveText(expectedFuelRate.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L/h');
  const expectedRatio = saved[column('Engine_W')] / saved[column('Fuel_W')] * 100;
  await expect(valueInDialog(page, '输出 / 燃油化学功率')).toHaveText(expectedRatio.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %');
});
