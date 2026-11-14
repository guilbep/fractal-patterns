import { expect, test } from '@playwright/test';

// Sprigs prefers stroke width 1 when a visitor chooses it, but a link is the source of truth:
// without `w` it opens with the global default, with `w` it keeps that value.
const stroke = (page: import('@playwright/test').Page) => page.locator('output[for="stroke"]');

test('Sprigs stroke: a link without w opens with the global default', async ({ page }) => {
  await page.goto('/index.html#k=sprigs&s=7');
  await expect(stroke(page)).toHaveText('2 px');
});

test('Sprigs stroke: a link with w keeps it', async ({ page }) => {
  await page.goto('/index.html#k=sprigs&s=7&w=3');
  await expect(stroke(page)).toHaveText('3 px');
});

test('Sprigs stroke: choosing the card sets 1, and one Undo brings back the kind and the stroke', async ({ page }) => {
  await page.goto('/index.html#k=tree&s=7&w=3');
  await expect(stroke(page)).toHaveText('3 px');
  await page.getByRole('tab', { name: /^Themes/ }).click();
  await page.locator('label.kind', { hasText: 'Sprigs' }).click();
  await expect(stroke(page)).toHaveText('1 px');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('k=sprigs');
  await page.waitForTimeout(400); // the history commits after a 300 ms pause
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
  await expect(stroke(page)).toHaveText('3 px');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('k') ?? 'tree')).toBe('tree');
});
