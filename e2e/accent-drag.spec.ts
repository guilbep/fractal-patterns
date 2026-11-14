import { expect, test, type Page } from '@playwright/test';

// The preview is the exported .fp-pattern class: its ::before carries the backgrounds, accent on top.
const image = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before').backgroundImage);
const am = (page: Page) => new URL(page.url()).hash.match(/[#&]am=([^&]*)/)?.[1] ?? '';
const move = (page: Page, i: number) => {
  const m = am(page).match(new RegExp(`(?:^|_)${i}\\.(-?\\d+)\\.(-?\\d+)`));
  return m ? [Number(m[1]) / 10, Number(m[2]) / 10] : null;
};

async function openEditor(page: Page) {
  await page.getByRole('tab', { name: 'Pattern' }).click();
  await page.getByRole('heading', { name: 'Accent shapes' }).click();
  await page.getByRole('button', { name: 'Edit shapes' }).click();
  const editor = page.getByRole('group', { name: 'Accent shapes, one tile' });
  await expect(editor).toBeVisible();
  await editor.scrollIntoViewIfNeeded();
  const box = (await editor.boundingBox())!;
  const tile = Number((await editor.getAttribute('viewBox'))!.split(' ')[2]);
  return { editor, box, scale: box.width / tile };
}

// Drags from the tile point (x, y) by (dx, dy) screen px, with Shift held: no snapping to the grid.
async function drag(page: Page, box: { x: number; y: number }, scale: number, [x, y]: number[], [dx, dy]: number[]) {
  const sx = box.x + x! * scale;
  const sy = box.y + y! * scale;
  await page.keyboard.down('Shift');
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + dx! / 2, sy + dy! / 2, { steps: 4 });
  await page.mouse.move(sx + dx!, sy + dy!, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
}

test('Pattern › Accent shapes › Edit shapes: drag and arrow keys move a shape, the link keeps it, Undo takes a drag back', async ({
  page,
}) => {
  await page.goto('/index.html#k=hex&s=1&al=1_d_15_100_g_4');
  const { editor, box, scale } = await openEditor(page);
  await expect(page.getByRole('button', { name: 'Shape 1 of 16, at 15, 15' })).toBeVisible();
  await drag(page, box, scale, [15, 15], [10, 5]);
  await expect(page).toHaveURL(/am=0\./);
  const [dx, dy] = move(page, 0)!;
  expect(Math.abs(dx! - 10 / scale)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(dy! - 5 / scale)).toBeLessThanOrEqual(0.5);

  // The dragged shape has the focus: an arrow key moves it 1 px.
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => move(page, 0)?.[0]).toBeCloseTo(dx! - 1, 5);

  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(page.getByRole('button', { name: 'Edit shapes' })).toBeFocused();

  const before = await image(page);
  const link = am(page);
  await page.reload();
  await expect.poll(() => image(page)).toBe(before);
  expect(am(page)).toBe(link);

  // The undo history starts again at a reload: one more drag (many pointer moves) is one Undo step.
  const again = await openEditor(page);
  await drag(page, again.box, again.scale, [45, 15], [12, 0]);
  await expect(page).toHaveURL(/am=0\.[-\d.]+_1\./);
  await page.getByRole('toolbar', { name: 'Design actions' }).getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => am(page)).toBe(link);
});
