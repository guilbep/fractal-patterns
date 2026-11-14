import { expect, test, type Page } from '@playwright/test';

// Grain: a noise tile on the preview element itself, under the pattern layer (::before). Linked as `gr`.
const images = (page: Page) =>
  page.evaluate(() => {
    const hero = document.querySelector('.hero.fp-pattern')!;
    // Each image is url("data:…"); the grain's own filter="url(#g)" sits inside its data URI, so count url(" only.
    const n = (s: string) => (s.match(/url\("/g) ?? []).length;
    return n(getComputedStyle(hero).backgroundImage) + n(getComputedStyle(hero, '::before').backgroundImage);
  });
const gr = (page: Page) => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('gr'));

test('Grain: the switch adds gr to the link and a second background image, and a reload keeps it', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/index.html#k=hex&s=1');
  await expect.poll(() => images(page)).toBe(1);
  await page.getByRole('tab', { name: /^Repetition/ }).click();
  await page.locator('summary', { hasText: 'More ways to hide the repeat' }).click();
  await page.getByRole('switch', { name: 'Grain' }).check();
  await expect(page.locator('summary', { hasText: 'More ways to hide the repeat' })).toContainText('grain');
  await expect.poll(() => gr(page)).toBe('12_0.75_d');
  await expect.poll(() => images(page)).toBe(2);
  await page.reload();
  await expect.poll(() => gr(page)).toBe('12_0.75_d');
  await expect.poll(() => images(page)).toBe(2);
  expect(errors).toEqual([]);
});
