import { expect, test, type Page } from '@playwright/test';

// The preview is the exported .fp-pattern class: its ::before carries the backgrounds, accent on top.
const layer = (page: Page) =>
  page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before');
    return { image: s.backgroundImage, size: s.backgroundSize };
  });
const urls = (s: string) => s.split('url(').length - 1;

test('Truchet with av: the dots vary over a 6 by 6 super tile above the 96 px waves', async ({ page }) => {
  await page.goto('/index.html#k=truchet&s=7&d=4&z=96&w=5&av=a_6_35_50_28_0');
  await expect.poll(async () => urls((await layer(page)).image)).toBe(2);
  const { size } = await layer(page);
  expect(size).toContain('576px');
  expect(size.split(',')[1]).toContain('96px');
});

test('hex with al: the accent shapes show as a second background', async ({ page }) => {
  await page.goto('/index.html#k=hex&s=1&al=1_d_15_100_g_8');
  await expect.poll(async () => urls((await layer(page)).image)).toBe(2);
});

test('hex without al: one background, as before', async ({ page }) => {
  await page.goto('/index.html#k=hex&s=1');
  await expect.poll(async () => urls((await layer(page)).image)).toBe(1);
});
