import { expect, test, type Page } from '@playwright/test';

// The preview is the exported .fp-pattern class: its ::before carries the backgrounds, accent on top.
const image = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before').backgroundImage);

test('Pattern › Accent shapes: Keep clear of the lines reaches the link, survives a reload, and moves the shapes', async ({ page }) => {
  await page.goto('/index.html#k=truchet&s=7&d=4&z=96&w=5&al=1_d_15_100_g_4');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await page.getByRole('heading', { name: 'Accent shapes' }).click();
  const sw = page.getByRole('switch', { name: 'Keep clear of the lines' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => image(page)).toContain('url(');
  const before = await image(page);
  await sw.click();
  await expect(page).toHaveURL(/al=1_d_15_100_g_4_1(&|$)/);
  await expect.poll(() => image(page)).not.toBe(before);
  await page.reload();
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await page.getByRole('heading', { name: 'Accent shapes' }).click();
  await expect(page.getByRole('switch', { name: 'Keep clear of the lines' })).toHaveAttribute('aria-checked', 'true');
});
