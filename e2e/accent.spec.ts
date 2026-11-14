import { expect, test } from '@playwright/test';

// No current kind marks accent shapes: the Accent role stays hidden, and a palette pick leaves `ac` out of the link.
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
