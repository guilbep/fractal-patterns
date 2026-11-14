import { expect, test } from '@playwright/test';

const heroImage = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before').backgroundImage);

test('Interlace: on weaves the hero and goes in the link; off takes it out', async ({ page }) => {
  await page.goto('/index.html#k=star-488&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  const sw = page.getByRole('switch', { name: 'Interlace', exact: true });
  await expect(sw).toBeVisible();
  expect(page.url()).not.toContain('il=');

  const before = await heroImage(page);
  await sw.click();
  await expect.poll(() => heroImage(page)).not.toBe(before);
  await expect.poll(() => page.url()).toContain('il=1');
  await expect(page.locator('#il-width')).toBeVisible();
  await expect(page.locator('#il-gap')).toBeVisible();

  await sw.click();
  await expect.poll(() => page.url()).not.toContain('il=');
  await expect.poll(() => heroImage(page)).toBe(before);
});

test('Interlace on Truchet: the lines only touch, and the control says so', async ({ page }) => {
  await page.goto('/index.html#k=truchet&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await page.getByRole('switch', { name: 'Interlace', exact: true }).click();
  await expect(page.getByText("Interlace needs crossing lines; this pattern's lines only touch.")).toBeVisible();
});

test('Interlace on Penrose arcs: the control says why it is off', async ({ page }) => {
  await page.goto('/index.html#k=penrosearcs&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await expect(page.getByText('Interlace does not follow the arcs; choose Penrose rhombs to use it.')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Interlace', exact: true })).toBeDisabled();
});
