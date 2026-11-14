import { expect, test } from '@playwright/test';

// The canvas script draws the same tile as the preview, fills included.
test('the canvas script carries the fill color', async ({ page }) => {
  await page.goto('/index.html#k=hex&s=1&fi=c_ff0000_1');
  await page.getByRole('tab', { name: 'Use it' }).click();
  await page.locator('summary', { hasText: 'Other formats' }).click();
  await expect(page.locator('details.alt textarea').first()).toHaveValue(/ff0000/i);
});
