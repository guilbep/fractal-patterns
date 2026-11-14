import { expect, test } from '@playwright/test';

const heroImage = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before').backgroundImage);

test('Color each region: Neighbours differ fills the regions and goes in the link; Off takes it out', async ({ page }) => {
  await page.goto('/index.html#k=star-488&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  const group = page.getByRole('radiogroup', { name: 'Color each region' });
  await expect(group).toBeVisible();
  expect(page.url()).not.toContain('rc=');

  const before = await heroImage(page);
  await group.getByRole('radio', { name: 'Neighbours differ' }).click();
  await expect.poll(() => heroImage(page)).not.toBe(before);
  await expect.poll(() => page.url()).toContain('rc=2');
  await expect(page.getByRole('radiogroup', { name: 'Colors', exact: true })).toBeVisible();

  await group.getByRole('radio', { name: 'Off', exact: true }).click();
  await expect.poll(() => page.url()).not.toContain('rc=');
  await expect.poll(() => heroImage(page)).toBe(before);
});
