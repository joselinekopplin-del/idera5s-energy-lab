import { test, expect } from '@playwright/test';
import { canvas, cameraDistance, clickPart, distance, moveSlider, openLab, ready, state } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await ready(page);
});

test('homepage loads real GLB and lazily requests only one saved result', async ({ page }, testInfo) => {
  await expect(page).toHaveTitle('ID.ERA 5S | Energy Lab');
  await expect(page.getByText('Interactive Vehicle Energy Management Simulator', { exact: true })).toBeVisible();
  await expect(page.locator('footer')).toContainText('非上汽大众官方软件');
  const s = await state(page);
  expect(s.triangles).toBeGreaterThan(10000);
  expect(s.drawCalls).toBeGreaterThan(5);
  expect(s.quality).toBe('standard');
  const resultRequests = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /\/data\/(?!catalog)[A-Za-z0-9_]+\.json/.test(name)));
  expect(resultRequests).toHaveLength(1);
  await testInfo.attach('initial-webgl-diagnostics', { body: JSON.stringify(s, null, 2), contentType: 'application/json' });
});

test('real mouse drag rotates, wheel zooms and pointer interaction stops autorotation', async ({ page }) => {
  await page.getByRole('switch', { name: '自动旋转', exact: true }).click();
  await expect.poll(async () => (await state(page)).auto).toBe(true);
  await canvas(page).scrollIntoViewIfNeeded();
  const bounds = (await canvas(page).boundingBox())!;
  const before = await state(page);
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .48);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .56, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => distance((await state(page)).camera, before.camera)).toBeGreaterThan(.4);
  await expect(page.getByRole('switch', { name: '自动旋转', exact: true })).toHaveAttribute('aria-checked', 'false');
  const rotated = await state(page);
  await page.mouse.wheel(0, -280);
  await expect.poll(async () => cameraDistance(await state(page))).toBeLessThan(cameraDistance(rotated) - .2);
  await page.getByRole('button', { name: '复位视角', exact: true }).click();
  await expect.poll(async () => distance((await state(page)).camera, [7.5, 8.5, 3.7])).toBeLessThan(.15);
});

test('five paints, five lamp states, studio and all preset views change actual renderer state', async ({ page }) => {
  for (const [name, hex] of [['都市金','a49b80'],['天际灰','636d73'],['风尚青','487a7c'],['前卫黑','172126'],['摩登白','e6e8e4']]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await state(page)).paintHex).toBe(hex);
  }
  for (const [mode, active] of [['off', []], ['drl', ['drl']], ['head', ['drl','headlamp','taillamp']], ['tail', ['taillamp']], ['brake', ['taillamp','brakelamp']]] as [string,string[]][]) {
    await page.getByRole('combobox', { name: '灯光模式', exact: true }).selectOption(mode);
    const lamps = (await state(page)).lampEmissive;
    for (const key of ['drl','headlamp','taillamp','brakelamp']) {
      expect(lamps[key]?.length, `Missing ${key} mesh`).toBeGreaterThan(0);
      expect(lamps[key].every((intensity: number) => active.includes(key) ? intensity > 0 : intensity === 0)).toBe(true);
    }
  }
  await page.getByRole('combobox', { name: '摄影棚', exact: true }).selectOption('dark');
  await expect.poll(async () => (await state(page)).settings.studio).toBe('dark');
  for (const [name, id] of [['正侧方','side'], ['后 45°','rear45'], ['正前方','front'], ['正后方','rear'], ['俯视','top'], ['前 45°','front45']]) {
    const before = (await state(page)).camera;
    await page.getByRole('button', { name, exact: true }).click();
    await expect.poll(async () => (await state(page)).settings.view).toBe(id);
    await expect.poll(async () => distance((await state(page)).camera, before)).toBeGreaterThan(.5);
  }
});

test('light, dark and system themes, keyboard focus and help dialog work', async ({ page }) => {
  const theme = page.getByRole('combobox', { name: '界面主题' });
  await theme.selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(theme).toHaveValue('dark');
  await theme.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await theme.selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.topbar').getByRole('button', { name: '操作帮助', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '知道了', exact: true }).press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ready(page);
  const before = await state(page);
  await canvas(page).focus();
  await canvas(page).press('ArrowLeft');
  await expect.poll(async () => distance((await state(page)).camera, before.camera)).toBeGreaterThan(.1);
});

test('shell, exploded parts and actual raycast selection display saved component values', async ({ page }) => {
  await openLab(page);
  await page.getByRole('combobox', { name: '车身显示', exact: true }).selectOption('transparent');
  await expect.poll(async () => (await state(page)).partsVisible).toBe(true);
  await expect.poll(async () => (await state(page)).bodyVisible).toBe(true);
  await moveSlider(page.getByRole('slider', { name: '部件拆解', exact: true }), .65);
  await expect.poll(async () => (await state(page)).bodyZ).toBeGreaterThan(.4);
  await page.getByRole('combobox', { name: '车身显示', exact: true }).selectOption('hidden');
  await expect.poll(async () => (await state(page)).bodyVisible).toBe(false);
  await page.getByRole('button', { name: '俯视', exact: true }).click();
  await expect.poll(async () => (await state(page)).camera[2]).toBeGreaterThan(11);
  await page.waitForTimeout(700);
  await clickPart(page, 'battery');
  await expect(page.getByRole('dialog')).toContainText('动力电池 · 当前采样');
  await expect(page.getByRole('dialog')).toContainText('电池温度');
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await page.getByRole('button', { name: '发动机', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('发动机转速');
  await page.getByRole('dialog').press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('saved braking playback, wheel motion, reversed recovery arrows and synchronized chart cursors', async ({ page }) => {
  await openLab(page);
  await page.getByRole('combobox', { name: '驾驶工况', exact: true }).selectOption('braking');
  await expect(page.getByRole('button', { name: '播放回放', exact: true })).toBeEnabled();
  await page.getByRole('combobox', { name: '车身显示', exact: true }).selectOption('hidden');
  const slider = page.getByRole('slider', { name: '回放时间', exact: true });
  await moveSlider(slider, .46);
  await expect.poll(async () => (await state(page)).sample.Motor_W).toBeLessThan(-100);
  await expect.poll(async () => (await state(page)).arrows.find((flow: any) => flow.from === 'battery' && flow.to === 'motor')?.visible).toBe(true);
  const recovering = await state(page);
  const arrow = recovering.arrows.find((flow: any) => flow.from === 'battery' && flow.to === 'motor');
  const from = recovering.parts.motor, to = recovering.parts.battery;
  const expected = from.map((value: number, i: number) => value + (to[i] - value) * .68 + (i === 2 ? .2 : 0));
  expect(distance(arrow.position, expected)).toBeLessThan(.001);
  const oldWheelAngle = recovering.wheels[0];
  await page.getByRole('combobox', { name: '播放速度', exact: true }).selectOption('10');
  const oldTime = Number(await slider.inputValue());
  await page.getByRole('button', { name: '播放回放', exact: true }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(oldTime + 2);
  await page.getByRole('button', { name: '暂停回放', exact: true }).click();
  expect(Math.abs((await state(page)).wheels[0] - oldWheelAngle)).toBeGreaterThan(1);
  const chart = page.getByRole('slider', { name: '电池荷电状态', exact: true });
  await moveSlider(chart, .73);
  const chartTime = Number(await chart.getAttribute('aria-valuenow'));
  expect(Math.abs(Number(await slider.inputValue()) - chartTime)).toBeLessThanOrEqual(1);
  for (const name of ['参考车速', '动力系统功率', '累计电能']) await expect(page.getByRole('slider', { name, exact: true })).toHaveAttribute('aria-valuenow', String(chartTime));
  await expect(page.locator('.telemetry-panel')).toContainText('参考车速');
  await expect(page.locator('.telemetry-panel')).toContainText('未求解可观测的实际车速');
  await page.getByRole('switch', { name: '显示能量流', exact: true }).click();
  await expect.poll(async () => (await state(page)).arrows.every((flow: any) => !flow.visible)).toBe(true);
});

test('three infeasible winter strategies remain marked and ECMS remains feasible', async ({ page }) => {
  await openLab(page);
  await page.getByRole('combobox', { name: '驾驶工况', exact: true }).selectOption('winterMinus10');
  for (const strategy of ['EVPriority','Rule_Based','SOCHold']) {
    await page.getByRole('combobox', { name: '能量管理策略', exact: true }).selectOption(strategy);
    await expect(page.locator('.feasibility')).toContainText('存在动力缺口');
    await expect(page.locator('.feasibility')).toContainText('不能完全满足参考车速');
    await expect(page.getByRole('button', { name: '播放回放', exact: true })).toBeEnabled();
    await expect(page.locator('.data-provenance')).toContainText(`winterMinus10_${strategy}`);
  }
  await page.getByRole('combobox', { name: '能量管理策略', exact: true }).selectOption('ECMS');
  await expect(page.locator('.feasibility')).toContainText('参考工况可满足');
});

test('strategy analysis loads all four real runs, switches charts and can reopen a chosen replay', async ({ page }) => {
  await page.locator('.nav-rail').getByRole('link', { name: '策略分析', exact: true }).click();
  await page.getByRole('combobox', { name: '驾驶工况', exact: true }).selectOption('socHold');
  await expect(page.locator('.strategy-card')).toHaveCount(4);
  for (const metric of ['SOC','FuelUsed_L','BatteryNet_kWh','Engine_W','Motor_W','Regen_kWh']) {
    await page.getByRole('combobox', { name: '对比曲线', exact: true }).selectOption(metric);
    await expect(page.locator('.comparison-chart .chart-legend span')).toHaveCount(4);
    await expect(page.locator('.comparison-chart svg path[stroke]')).toHaveCount(4);
  }
  await expect(page.locator('.strategy-card').first()).toContainText('发动机启动');
  await expect(page.locator('.strategy-card').first()).toContainText('最终 SOC');
  await page.locator('.strategy-card').filter({ has: page.getByRole('heading', { name: '电量保持', exact: true }) }).getByRole('link', { name: '查看回放' }).click();
  await expect(page.getByRole('combobox', { name: '驾驶工况', exact: true })).toHaveValue('socHold');
  await expect(page.getByRole('combobox', { name: '能量管理策略', exact: true })).toHaveValue('SOCHold');
});

test('hash routes survive refresh and requested local resources return no HTTP errors', async ({ page }) => {
  const failures: string[] = [], exceptions: string[] = [];
  page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === new URL(page.url()).origin) failures.push(`${response.status()} ${response.url()}`); });
  page.on('pageerror', error => exceptions.push(error.message));
  for (const hash of ['#/home', '#/lab', '#/analysis', '#/about']) {
    await page.goto(hash);
    await page.reload();
    await expect(page.locator('main h1')).toBeVisible();
    if (hash === '#/home' || hash === '#/lab') await ready(page);
    if (hash === '#/analysis') await expect(page.locator('.strategy-card')).toHaveCount(4);
  }
  expect(failures).toEqual([]);
  expect(exceptions).toEqual([]);
});

test('LOD switches stabilize GPU geometry and texture counts without growing each cycle', async ({ page }, testInfo) => {
  const metrics: any[] = [];
  for (const quality of ['high', 'low', 'standard', 'high', 'low', 'standard']) {
    const previousTriangles = (await state(page)).triangles;
    await page.getByRole('combobox', { name: '画质', exact: true }).selectOption(quality);
    await expect.poll(async () => (await state(page)).quality).toBe(quality);
    // Geometry counts update only when the new GLB is installed and rendered.
    await expect.poll(async () => (await state(page)).triangles).not.toBe(previousTriangles);
    await page.waitForTimeout(200);
    metrics.push(await state(page));
  }
  expect(metrics[2].triangles).toBeGreaterThan(metrics[1].triangles);
  expect(metrics[0].triangles).toBeGreaterThan(metrics[2].triangles);
  expect(metrics[5].geometries).toBe(metrics[2].geometries);
  expect(metrics[5].textures).toBe(metrics[2].textures);
  await testInfo.attach('lod-resource-cycles', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
});
