import { expect, test } from '@playwright/test';

// The CSS export carries the design's colors and the chosen palette as custom properties; the grain lights the Repetition dot.
test('CSS colors: a palette adds --fp-palette-1 and --fp-pattern; grain alone shows the Repetition dot', async ({ page }) => {
  await page.goto('/index.html#k=hex&s=1');
  await page.getByRole('tab', { name: /^Colors/ }).click();
  await page.locator('summary', { hasText: 'Start from a palette' }).click();
  await page.locator('button.palette').first().click();
  await expect(page.locator('button.palette').first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Use it' }).click();
  const code = page.locator('#panel-use pre.code').first();
  await expect(code).toContainText('--fp-palette-1:');
  await expect(code).toContainText('--fp-pattern:');

  const rep = page.getByRole('tab', { name: /^Repetition/ });
  await expect(rep.locator('.tab-on')).toHaveCount(0);
  await rep.click();
  await page.locator('summary', { hasText: 'More ways to hide the repeat' }).click();
  await page.getByRole('switch', { name: 'Grain' }).check();
  await expect(rep.locator('.tab-on')).toHaveCount(1);
});
