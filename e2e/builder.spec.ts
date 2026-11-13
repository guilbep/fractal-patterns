import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const KEY = 'fp-builder-design-v1';
const WIDTH = 240;
const fixture = (name: string): string => new URL(`fixtures/${name}`, import.meta.url).pathname;

type Stored = { background: string | null; stamps: unknown[]; items: { id: number; x: number; rotate: number; flip: boolean }[] };

const stored = (page: Page): Promise<Stored | null> =>
  page.evaluate((key) => {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  }, KEY);
const itemCount = async (page: Page): Promise<number> => (await stored(page))?.items.length ?? -1;
const stage = (page: Page) => page.getByRole('application', { name: /Tile editor/ });
/** Distinct shapes drawn on the stage. */
const stageCount = (page: Page): Promise<number> =>
  page.evaluate(() => new Set([...document.querySelectorAll('svg.tile-editor [data-item]')].map((e) => e.getAttribute('data-item'))).size);
const panel = (page: Page) => page.getByRole('region', { name: 'Selected shape' });

/** A filled shape that is the top element at its own center, inside the stage's central tile. */
const pickShape = (page: Page): Promise<{ id: number; x: number; y: number; perUnit: number }> =>
  page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('svg.tile-editor')!;
    const ctm = svg.getScreenCTM()!;
    const cell = svg.querySelector('.cell-edge')!.getBoundingClientRect();
    for (const el of svg.querySelectorAll<SVGUseElement>('use[data-item]')) {
      if (el.getAttribute('fill') === 'none') continue;
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (x < cell.left || x > cell.right || y < cell.top || y > cell.bottom) continue;
      if (document.elementFromPoint(x, y) === el) return { id: Number(el.getAttribute('data-item')), x, y, perUnit: ctm.a };
    }
    throw new Error('no shape on top at its own center');
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/builder.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(stage(page)).toBeVisible();
});

/** Commit the default design, so the stored copy holds the start state. */
async function startAgain(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect.poll(() => itemCount(page)).toBe(16);
}

test('the default design has 16 shapes', async ({ page }) => {
  expect(await stageCount(page)).toBe(16);
  await startAgain(page);
});

test('a drag past the tile edge wraps the shape', async ({ page }) => {
  await startAgain(page);
  const s = await pickShape(page);
  const x0 = (await stored(page))!.items.find((it) => it.id === s.id)!.x;
  const dx = 1.2 * WIDTH * s.perUnit;
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + dx / 2, s.y, { steps: 5 });
  await page.mouse.move(s.x + dx, s.y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await stored(page))!.items.find((it) => it.id === s.id)!.x).not.toBe(x0);
  const x = (await stored(page))!.items.find((it) => it.id === s.id)!.x;
  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThan(WIDTH);
  const d = await stored(page);
  const name = (d!.stamps[(d!.items.find((it) => it.id === s.id) as unknown as { stamp: number }).stamp] as { name: string }).name;
  await expect(panel(page).getByText(name, { exact: true })).toBeVisible();
});

test('keys change the selected shape', async ({ page }) => {
  await startAgain(page);
  const s = await pickShape(page);
  await page.mouse.click(s.x, s.y);
  await expect(panel(page).getByLabel(/Turn/)).toBeVisible();
  const item = async () => (await stored(page))!.items.find((it) => it.id === s.id)!;
  const start = await item();
  const mod = (v: number, m: number) => ((v % m) + m) % m;

  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await item()).x).toBeCloseTo(mod(start.x - 1, WIDTH), 6);
  await page.keyboard.press(']');
  await expect.poll(async () => mod((await item()).rotate, 360)).toBeCloseTo(mod(start.rotate + 15, 360), 6);
  await page.keyboard.press('f');
  await expect.poll(async () => (await item()).flip).toBe(!start.flip);
  await page.keyboard.press('d');
  await expect.poll(() => itemCount(page)).toBe(17);
  await page.keyboard.press('Delete');
  await expect.poll(() => itemCount(page)).toBe(16);
});

test('Undo and Redo change the item count', async ({ page }) => {
  await startAgain(page);
  await page.getByRole('button', { name: 'Ring', exact: true }).click();
  await expect.poll(() => itemCount(page)).toBe(17);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => itemCount(page)).toBe(16);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(() => itemCount(page)).toBe(17);
});

test('a click in the center of a ring selects it', async ({ page }) => {
  await page.getByRole('button', { name: 'Ring', exact: true }).click();
  await expect.poll(() => itemCount(page)).toBe(17);
  await stage(page).focus();
  await page.keyboard.press('Escape');
  await expect(panel(page).getByText('Select a shape on the tile.')).toBeVisible();
  const p = await page.evaluate((half) => {
    const svg = document.querySelector<SVGSVGElement>('svg.tile-editor')!;
    const q = new DOMPoint(half, half).matrixTransform(svg.getScreenCTM()!);
    return { x: q.x, y: q.y };
  }, WIDTH / 2);
  await page.mouse.click(p.x, p.y);
  await expect(panel(page).getByText('Ring', { exact: true })).toBeVisible();
});

test('two SVG files become two shapes', async ({ page }) => {
  await startAgain(page);
  const before = (await stored(page))!;
  await page.getByLabel('Add SVG files or an image').setInputFiles([fixture('square.svg'), fixture('triangle.svg')]);
  await expect(page.getByRole('status').filter({ hasText: 'Added' })).toHaveText('Added 2 shapes.');
  await expect.poll(async () => (await stored(page))!.items.length).toBe(before.items.length + 2);
  expect((await stored(page))!.stamps.length).toBe(before.stamps.length + 2);
});

test('fill the tile with a 5 by 3 grid, then undo', async ({ page }) => {
  await startAgain(page);
  await page.getByText('Fill the tile with a grid').click();
  for (const [label, value] of [
    [/^Columns/, '5'],
    [/^Rows/, '3'],
  ] as const)
    await page.getByLabel(label).evaluate((el, v) => {
      (el as HTMLInputElement).value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  await page.getByRole('button', { name: 'Fill the tile', exact: true }).click();
  await expect.poll(() => itemCount(page)).toBe(15);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => itemCount(page)).toBe(16);
});

test('Half-drop changes the stage viewBox', async ({ page }) => {
  await page.getByRole('heading', { name: 'Tile', exact: true }).click();
  await page.getByLabel('Repeat').selectOption({ label: 'Half-drop' });
  await expect(stage(page)).toHaveAttribute('viewBox', '-240 -120 960 480');
});

test('an example changes the background, and Undo restores it', async ({ page }) => {
  await startAgain(page);
  const bg = (await stored(page))!.background;
  await page.getByLabel('Example', { exact: true }).selectOption({ label: 'Scales' });
  await expect.poll(async () => (await stored(page))!.background).not.toBe(bg);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await stored(page))!.background).toBe(bg);
});

test('Download SVG gives a clean svg file', async ({ page }) => {
  await page.getByRole('button', { name: 'Use it…' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download SVG' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  const text = await readFile(await download.path(), 'utf8');
  expect(text.startsWith('<svg')).toBe(true);
  expect(text).not.toContain('<script');
});

test('the design is still there after a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Ring', exact: true }).click();
  await expect.poll(() => itemCount(page)).toBe(17);
  await page.reload();
  await expect(stage(page)).toBeVisible();
  expect(await stageCount(page)).toBe(17);
});

test('keyboard selects shapes', async ({ page }) => {
  await startAgain(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
  const live = page.locator('.stage-editor [aria-live="polite"]');
  await stage(page).focus();
  await page.keyboard.press('n');
  await expect(panel(page).getByText('Select a shape on the tile.')).toHaveCount(0);
  await expect(live).toHaveText(/shape 1 of 16$/);
  const name = (await live.innerText()).split(',')[0]!;
  await expect(panel(page).getByText(name, { exact: true })).toBeVisible();
  const first = await panel(page).innerText();
  for (let k = 2; k <= 17; k++) await page.keyboard.press('n');
  await expect(live).toHaveText(/shape 1 of 16$/);
  expect(await panel(page).innerText()).toBe(first);
  await page.keyboard.press('p');
  await expect(live).toHaveText(/shape 16 of 16$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(before);
});

test('snap places a dragged shape on the grid', async ({ page }) => {
  await startAgain(page);
  await page.getByLabel('Snap').check();
  await expect(page.getByRole('radio', { name: '8' })).toBeChecked();
  const s = await pickShape(page);
  const x0 = (await stored(page))!.items.find((it) => it.id === s.id)!.x;
  const dx = 47 * s.perUnit;
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + dx, s.y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await stored(page))!.items.find((it) => it.id === s.id)!.x).not.toBe(x0);
  const it = (await stored(page))!.items.find((t) => t.id === s.id) as unknown as { x: number; y: number };
  for (const v of [it.x, it.y]) {
    expect(Math.abs(v / 30 - Math.round(v / 30))).toBeLessThan(1e-6);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(WIDTH);
  }
  await page.getByLabel('Snap').uncheck();
  await page.reload();
  await expect(stage(page)).toBeVisible();
  await expect(page.getByLabel('Snap')).not.toBeChecked();
});

test('multi-select moves a group', async ({ page }) => {
  await startAgain(page);
  const before = (await stored(page))!.items.map((it) => it.x);
  await stage(page).focus();
  await page.keyboard.press('ControlOrMeta+a');
  await expect(page.getByText('16 shapes selected')).toBeAttached();
  await page.keyboard.press('ArrowRight');
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  await expect.poll(async () => (await stored(page))!.items.map((it) => it.x)).not.toEqual(before);
  const after = (await stored(page))!.items.map((it) => it.x);
  after.forEach((x, k) => expect(x).toBeCloseTo(mod(before[k]! + 1, WIDTH), 6));
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await stored(page))!.items.map((it) => it.x)).toEqual(before);
});

test('mirror repeat drags a mirrored copy', async ({ page }) => {
  await startAgain(page);
  await page.getByRole('heading', { name: 'Tile', exact: true }).click();
  await page.getByLabel('Repeat').selectOption({ label: 'Mirror' });
  await expect(stage(page)).toHaveAttribute('viewBox', '-240 -240 960 960');
  // A copy flipped in x only, on top at its own center, inside the stage.
  const s = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('svg.tile-editor')!;
    const box = svg.getBoundingClientRect();
    for (const el of svg.querySelectorAll<SVGUseElement>('use[data-item][data-fx="1"][data-fy="0"]')) {
      if (el.getAttribute('fill') === 'none') continue;
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
      if (document.elementFromPoint(x, y) === el) return { id: Number(el.getAttribute('data-item')), x, y, perUnit: svg.getScreenCTM()!.a };
    }
    throw new Error('no mirrored shape on top at its own center');
  });
  const x0 = (await stored(page))!.items.find((it) => it.id === s.id)!.x;
  const dx = 20 * s.perUnit;
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + dx, s.y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await stored(page))!.items.find((it) => it.id === s.id)!.x).not.toBe(x0);
  const x = (await stored(page))!.items.find((it) => it.id === s.id)!.x;
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  // The item moved left by about 20, modulo the tile width.
  const off = mod(x - (x0 - 20), WIDTH);
  expect(Math.min(off, WIDTH - off)).toBeLessThan(1.5);
});
