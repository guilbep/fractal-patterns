import { expect, test } from '@playwright/test';

test('Breed grows nine children, one becomes the wallpaper with its genes in the link, and Undo generation goes back', async ({ page }) => {
  await page.goto('/studio.html#s=42&ba=1&gr=1');
  await page.locator('summary', { hasText: 'Breed' }).click();
  const children = page.getByRole('group', { name: /^Children, generation/ }).getByRole('button');
  await expect(children).toHaveCount(9);
  await expect(page.getByRole('button', { name: /growing$/ })).toHaveCount(0, { timeout: 15000 });

  const use = page.getByRole('button', { name: 'Use the picked one' });
  await expect(use).toBeDisabled();
  const fifth = children.nth(4);
  await fifth.click();
  await expect(fifth).toHaveAttribute('aria-pressed', 'true');
  await use.click();
  await expect.poll(() => page.evaluate(() => location.hash)).not.toBe('#s=42&ba=1&gr=1');
  const bred = await page.evaluate(() => location.hash);

  // The link opens the same design (a new page load, not a hash change).
  await page.goto('about:blank');
  await page.goto(`/studio.html${bred}`);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe(bred);

  await page.locator('summary', { hasText: 'Breed' }).click();
  await expect(page.getByRole('button', { name: /growing$/ })).toHaveCount(0, { timeout: 15000 });
  const undoGen = page.getByRole('button', { name: 'Undo generation' });
  await expect(undoGen).toBeDisabled();
  await page.getByRole('button', { name: 'Breed next generation' }).click();
  await expect(page.getByRole('group', { name: 'Children, generation 2' })).toBeVisible();
  await expect(undoGen).toBeEnabled();
  await undoGen.click();
  await expect(page.getByRole('group', { name: 'Children, generation 1' })).toBeVisible();
});
