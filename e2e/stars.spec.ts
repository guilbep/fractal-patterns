import { expect, test } from '@playwright/test';

const heroImage = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before').backgroundImage);

test('Star patterns: the contact angle changes the pattern and the link', async ({ page }) => {
  await page.goto('/index.html#k=star-488&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  const angle = page.getByLabel(/^Contact angle/);
  await expect(angle).toBeVisible();
  await expect(page.locator('output[for="angle"]')).toHaveText('78°');
  expect(page.url()).not.toContain('ca=');

  const before = await heroImage(page);
  await angle.fill('40');
  await expect(page.locator('output[for="angle"]')).toHaveText('40°');
  await expect.poll(() => heroImage(page)).not.toBe(before);
  await expect.poll(() => page.url()).toContain('ca=40');

  // The library has its own tab with the five tilings.
  const tab = page.getByRole('tab', { name: /^Star patterns/ });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#lib-panel .kind')).toHaveCount(5);
  await expect(page.locator('#lib-panel')).toContainText('4.8.8 stars');
});

test('Star patterns: no contact angle on another kind', async ({ page }) => {
  await page.goto('/index.html#k=tree&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await expect(page.locator('#seed')).toBeVisible();
  await expect(page.getByLabel(/^Contact angle/)).toHaveCount(0);
});
