import { expect, test } from '@playwright/test';

test('the T button hides the preview text without changing the contrast check', async ({ page }) => {
  await page.goto('/index.html');
  const t = page.getByRole('button', { name: 'Show the text' });
  const text = page.locator('.hero-text');
  const chip = page.locator('.toolbar .bar-chip', { hasText: ':1' });
  await expect(t).toHaveAttribute('aria-pressed', 'true');
  await expect(text).toBeVisible();
  const before = await chip.textContent();
  await t.focus();
  await page.keyboard.press('Enter');
  await expect(t).toHaveAttribute('aria-pressed', 'false');
  await expect(text).toBeHidden();
  await expect(chip).toHaveText(before ?? '');
  await t.click();
  await expect(text).toBeVisible();
});
