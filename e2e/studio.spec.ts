import { expect, test } from '@playwright/test';

test('studio undo and redo', async ({ page }) => {
  await page.goto('/studio.html');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/studio.html');
  const seed = page.locator('#seed');
  const density = page.locator('#density');
  const toolbar = page.getByRole('toolbar', { name: 'Wallpaper actions' });
  const undo = toolbar.getByRole('button', { name: 'Undo' });
  const redo = toolbar.getByRole('button', { name: 'Redo' });

  const first = await seed.inputValue();
  await toolbar.getByRole('button', { name: 'Shuffle' }).click();
  await expect(seed).not.toHaveValue(first);
  const second = await seed.inputValue();
  await expect(undo).toBeEnabled({ timeout: 1000 });
  await undo.click();
  await expect(seed).toHaveValue(first);
  await redo.click();
  await expect(seed).toHaveValue(second);

  // Five quick key presses on the slider are one undo step.
  const before = await density.inputValue();
  await density.focus();
  for (let i = 0; i < 5; i++) await density.press('ArrowRight');
  await expect(density).not.toHaveValue(before);
  await page.waitForTimeout(400);
  await density.blur();
  await page.locator('body').press('ControlOrMeta+z');
  await expect(density).toHaveValue(before);

  // In the seed field, the browser's own text undo works; the design history does not step.
  const now = await seed.inputValue();
  await seed.focus();
  await seed.press('ControlOrMeta+z');
  await page.waitForTimeout(400);
  await expect(seed).toHaveValue(now);
  await expect(density).toHaveValue(before);
});
