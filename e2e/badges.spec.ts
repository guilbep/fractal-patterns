import { expect, test } from '@playwright/test';

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the contrast chip opens the contrast check in Colors', async ({ page }) => {
    await page.goto('/');
    const chip = page.locator('.toolbar').getByRole('button', { name: /show the contrast check/ });
    await expect(chip).toHaveAccessibleName(/^Contrast [\d.]+:1 AA (pass|fail), show the contrast check$/);
    await chip.click();
    await expect(page.getByRole('tab', { name: 'Colors' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#contrast-h')).toBeFocused();
  });

  test('the size badge opens Use it on Website, at the performance settings', async ({ page }) => {
    await page.goto('/');
    await page.locator('.toolbar .size-badge').click();
    await expect(page.getByRole('tab', { name: 'Use it' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-use .use-it-dests input[value="web"]')).toBeChecked();
    await expect(page.locator('#perf-h')).toBeFocused();
  });
});

test('on a phone the size badge opens the Use it sheet at the performance settings', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.locator('.phone-chips .size-badge').click();
  await expect(page.locator('dialog.sheet-use')).toBeVisible();
  await expect(page.locator('dialog.sheet-use #perf-h')).toBeFocused();
});

test('Studio: a click pins the size tooltip; a second click or Esc hides it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/studio.html');
  const badge = page.locator('.size-badge:visible').first();
  const tip = badge.locator('.size-tip');
  await badge.click();
  await expect(tip).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(tip).toBeVisible();
  await badge.click();
  await expect(tip).toBeHidden();
  await badge.click();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
});
