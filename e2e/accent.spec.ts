import { expect, test } from '@playwright/test';

// Hex marks no accent shapes (Truchet and Sprigs do): the Accent role stays hidden, and a palette pick leaves `ac` out of the link.
test('Accent: hidden for a kind without accent shapes, and no ac key after a palette pick', async ({ page }) => {
  await page.goto('/index.html#k=hex&s=1');
  await page.getByRole('tab', { name: /^Colors/ }).click();
  await expect(page.locator('#fill-mode')).toBeVisible();
  await expect(page.locator('#accent-picker')).toHaveCount(0);
  await expect(page.getByText('On the accent')).toHaveCount(0);

  await page.locator('summary', { hasText: 'Start from a palette' }).click();
  await page.locator('button.palette').nth(3).click();
  await expect(page.locator('button.palette').nth(3)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('bg=');
  expect(await page.evaluate(() => location.hash)).not.toContain('ac=');
  await expect(page.locator('#accent-picker')).toHaveCount(0);
});

// Any kind with accent shapes on gets the Accent role, so the shapes' color can be changed from the Colors tab.
test('Accent: shown for any kind once accent shapes are on, and its color reaches the link', async ({ page }) => {
  await page.goto('/index.html#k=hex&s=1&al=1_d_15_100_g_8');
  await page.getByRole('tab', { name: /^Colors/ }).click();
  await expect(page.locator('#accent-picker')).toHaveCount(1);
  await expect(page.getByText('On the accent').first()).toBeVisible();
  await page.locator('#accent-hex').fill('#123456');
  await page.locator('#accent-hex').press('Enter');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('ac=123456');
});
