import { expect, type Page, type Locator } from '@playwright/test';

export const canvas = (page: Page) => page.getByRole('img', { name: '可旋转和缩放的 ID.ERA 5S 三维模型', exact: true });

/** Read-only diagnostics. UI actions always use actual mouse, keyboard or touch input. */
export async function state(page: Page) {
  return page.evaluate(() => {
    const engine = (window as any).__energyLab;
    if (!engine) return null;
    return {
      ...engine.snapshot(),
      sample: engine.sample,
      paintHex: engine.paint?.color.getHexString(),
      lampEmissive: Object.fromEntries(Object.entries(engine.lamps).map(([key, materials]: [string, any]) => [key, materials.map((material: any) => material.emissiveIntensity)])),
      bodyVisible: engine.body?.visible,
      bodyZ: engine.body?.position.z,
      partsVisible: engine.parts.all.visible,
      parts: Object.fromEntries(Object.entries(engine.parts.groups).map(([key, group]: [string, any]) => [key, group.position.toArray()])),
      endpoints: Object.fromEntries([...Object.entries(engine.parts.groups), ...engine.wheels.map((wheel: any) => [wheel.name, wheel])].map(([key, group]: [string, any]) => [key, group.getWorldPosition(group.position.clone()).toArray()])),
      arrows: engine.flowGroups.map((flow: any) => ({ from: flow.from, to: flow.to, power: engine.sample[flow.power], visible: flow.group.visible, position: flow.arrow.position.toArray(), direction: flow.arrow.position.clone().set(0, 1, 0).applyQuaternion(flow.arrow.quaternion).toArray() })),
    };
  });
}

export async function ready(page: Page) {
  await expect(canvas(page)).toBeVisible();
  await expect.poll(async () => (await state(page))?.ready, { timeout: 45000 }).toBe(true);
  await expect.poll(async () => (await state(page))?.frameCount).toBeGreaterThan(5);
}

export async function openLab(page: Page) {
  await page.locator('.nav-rail').getByRole('link', { name: '能量实验室', exact: true }).click();
  await expect(page.getByRole('heading', { name: '能量实验室', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '播放回放', exact: true })).toBeEnabled();
  await ready(page);
}

export const distance = (a: number[], b: number[]) => Math.hypot(...a.map((value, i) => value - b[i]));
export const cameraDistance = (snapshot: any) => distance(snapshot.camera, snapshot.target);

export async function moveSlider(locator: Locator, fraction: number) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Slider has no visible bounds');
  await locator.click({ position: { x: Math.max(8, Math.min(bounds.width - 8, bounds.width * fraction)), y: bounds.height / 2 } });
}

export async function clickPart(page: Page, name: string) {
  await canvas(page).scrollIntoViewIfNeeded();
  const point = await page.evaluate((id) => {
    const engine = (window as any).__energyLab;
    const group = engine.parts.groups[id];
    const position = group.getWorldPosition(group.position.clone()).project(engine.camera);
    const bounds = engine.renderer.domElement.getBoundingClientRect();
    return { x: bounds.left + (position.x + 1) / 2 * bounds.width, y: bounds.top + (1 - position.y) / 2 * bounds.height };
  }, name);
  await page.mouse.click(point.x, point.y);
}
