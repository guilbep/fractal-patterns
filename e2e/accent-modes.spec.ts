import { expect, test, type Page } from '@playwright/test';

// The preview is the exported .fp-pattern class: its ::before carries the backgrounds, accent on top.
const images = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before').backgroundImage.split('url(').length - 1);

test('Patchwork: Accent shapes draw on a grid, without the kind’s own, and the link keeps them', async ({ page }) => {
  await page.goto('/index.html#k=truchet&s=7&l=patchwork');
  await page.getByRole('tab', { name: 'Pattern' }).click();
  await page.getByRole('heading', { name: 'Accent shapes' }).click();
  await expect.poll(() => images(page)).toBe(1);
  await page.getByRole('switch', { name: 'Show accent shapes' }).click();
  await expect(page.getByRole('button', { name: "Kind's own" })).toHaveCount(0);
  await expect(page.getByLabel('Where').locator('option')).toHaveText(['Scattered by the seed', 'On a grid']);
  await page.getByRole('button', { name: 'Ring', exact: true }).click();
  await expect(page).toHaveURL(/l=patchwork.*al=1_r_15_100_g_8/);
  await expect.poll(() => images(page)).toBe(2);
  await page.reload();
  await expect.poll(() => images(page)).toBe(2);
  await expect(page).toHaveURL(/al=1_r_15_100_g_8/);
});

// An image is not in the link (share.ts: the pixels never leave the browser), so this checks the drawing only.
test('Image sample: Accent shapes draw scattered triangles over the traced tile, and vary with Applies to Accent', async ({ page }) => {
  await page.goto('/index.html#k=tree&s=1');
  await page.getByRole('tab', { name: 'Image' }).click();
  await page.getByRole('button', { name: 'Brick wall' }).click();
  await page.getByRole('tab', { name: 'Pattern' }).click();
  await page.getByRole('heading', { name: 'Accent shapes' }).click();
  await page.getByRole('switch', { name: 'Show accent shapes' }).click();
  await page.getByRole('button', { name: 'Triangle', exact: true }).click();
  await page.getByLabel('Where').selectOption({ label: 'Scattered by the seed' });
  await expect(page.getByLabel('Where').locator('option')).toHaveCount(2);
  await expect.poll(() => images(page)).toBe(2);
  await page.getByRole('tab', { name: /^Repetition/ }).click();
  await page.getByRole('switch', { name: 'Reduce repetition' }).check();
  await page.getByRole('radiogroup', { name: 'Applies to' }).getByRole('radio', { name: 'Accent' }).click();
  await expect(page.locator('.accent-vary')).toBeVisible();
  await expect.poll(() => images(page)).toBe(2);
});
