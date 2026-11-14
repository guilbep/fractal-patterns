import { expect, test } from '@playwright/test';

const heroImage = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before').backgroundImage);

test('Line style: Brush changes the hero and goes in the link; Even takes it out', async ({ page }) => {
  await page.goto('/index.html#k=truchet&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  const group = page.getByRole('radiogroup', { name: 'Line style', exact: true });
  await expect(group).toBeVisible();
  expect(page.url()).not.toContain('ls=');

  const before = await heroImage(page);
  await group.getByText('Brush', { exact: true }).click();
  await expect.poll(() => heroImage(page)).not.toBe(before);
  await expect.poll(() => page.url()).toContain('ls=b');

  await group.getByText('Even', { exact: true }).click();
  await expect.poll(() => page.url()).not.toContain('ls=');
  await expect.poll(() => heroImage(page)).toBe(before);
});
