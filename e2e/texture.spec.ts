import { expect, test, type Page } from '@playwright/test';

// Texture: chosen under Colors › Background; it sits in grain's CSS slot on the preview element. Linked as `te`.
const bg = (page: Page) =>
  page.evaluate(() => {
    const hero = document.querySelector('.hero.fp-pattern')!;
    return getComputedStyle(hero).backgroundImage + '|' + getComputedStyle(hero, '::before').backgroundImage;
  });
const key = (page: Page, k: string) => page.evaluate((k) => new URLSearchParams(location.hash.slice(1)).get(k), k);

test('Texture: Paper changes the preview and adds te; Grain swaps it for gr; Bake it bakes', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const before = await bg(page);
  await page.getByRole('tab', { name: /^Colors/ }).click();
  await page.getByRole('radio', { name: 'Paper', exact: true }).check();
  await expect.poll(() => bg(page)).not.toBe(before);
  await expect.poll(() => key(page, 'te')).toMatch(/^paper\./);

  await page.getByRole('radio', { name: 'Grain', exact: true }).check();
  await expect.poll(() => key(page, 'gr')).not.toBeNull();
  expect(await key(page, 'te')).toBeNull();

  await page.getByRole('tab', { name: /^Repetition/ }).click();
  await page.locator('summary', { hasText: 'More ways to hide the repeat' }).click();
  await expect(page.getByText('Grain moved to Colors › Texture.')).toBeVisible();
  await page.getByRole('button', { name: 'Open Colors' }).click();
  await expect(page.getByRole('tab', { name: /^Colors/ })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('radio', { name: 'Paper', exact: true }).check();
  await page.getByRole('radio', { name: 'Live', exact: true }).click();
  await expect.poll(() => key(page, 'te')).toMatch(/\.l$/);
  await page.getByRole('button', { name: 'Bake it' }).click();
  await expect(page.getByText('Baking…')).toBeVisible();
  await expect(page.getByText('Baking…')).toBeHidden({ timeout: 15000 });
  await expect.poll(() => key(page, 'te')).toMatch(/\.b$/);

  await page.setViewportSize({ width: 360, height: 740 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});
