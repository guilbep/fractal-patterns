import { expect, test, type Page } from '@playwright/test';

const fullBackground = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const el = document.fullscreenElement;
    return el ? getComputedStyle(el).backgroundImage : null;
  });
const isFull = (page: Page): Promise<boolean> => page.evaluate(() => !!document.fullscreenElement);

test.beforeEach(async ({ page }) => {
  await page.goto('/builder.html');
  await page.getByRole('button', { name: 'Start again' }).click();
});

test('the Full screen button shows the pattern tiled, and leaving restores the page', async ({ page }) => {
  const btn = page.getByRole('button', { name: 'Full screen' });
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute('title', 'Full screen (F)');
  await btn.click();
  await expect.poll(() => fullBackground(page)).toContain('url(');
  // The tiled preview, not the editor.
  expect(await page.evaluate(() => document.fullscreenElement?.classList.contains('builder-full'))).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => isFull(page)).toBe(false);
  await expect(page.locator('.builder-full')).toBeHidden();
  await expect(btn).toBeVisible();
});

test('F opens full screen from the page, but not from the tile editor (F flips there)', async ({ page }) => {
  await page.locator('body').focus();
  await page.keyboard.press('f');
  await expect.poll(() => fullBackground(page)).toContain('url(');
  await page.keyboard.press('f');
  await expect.poll(() => isFull(page)).toBe(false);
  await page.locator('svg.tile-editor').focus();
  await page.keyboard.press('f');
  // Give a wrongly opened full screen time to show before checking that it did not.
  await page.waitForTimeout(500);
  expect(await isFull(page)).toBe(false);
});

test('with Use it open, the button still shows the tiled design', async ({ page }) => {
  await page.getByRole('button', { name: 'Use it…' }).click();
  const btn = page.getByRole('button', { name: 'Full screen' });
  await expect(btn).toBeVisible();
  await btn.click();
  await expect.poll(() => fullBackground(page)).toContain('url(');
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => isFull(page)).toBe(false);
});
