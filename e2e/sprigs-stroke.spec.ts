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
