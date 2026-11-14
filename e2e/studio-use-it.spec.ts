import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('Studio Use it: the CSS and SVG on the web, a desktop PNG at its size, then back to the design', async ({ page }) => {
  await page.goto('/studio.html');
  await page.getByRole('button', { name: 'Use it…' }).click();
  const panel = page.locator('.studio-use');
  await expect(panel.getByRole('radio', { name: /Website background/ })).toBeChecked();
  await expect(panel.getByRole('textbox', { name: 'CSS rule' })).toHaveValue(/\.wallpaper/);

  const [svg] = await Promise.all([page.waitForEvent('download'), panel.getByRole('link', { name: 'Download SVG' }).click()]);
  expect(svg.suggestedFilename()).toMatch(/^wallpaper-.*\.svg$/);

  await panel.getByText('Desktop wallpaper').click();
  await panel.getByText('Full HD').click();
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Download PNG · 1920 × 1080' }).click(),
  ]);
  expect(png.suggestedFilename()).toMatch(/-1920x1080\.png$/);
  const bytes = await readFile((await png.path())!);
  // PNG header: the IHDR width and height are bytes 16-23, big-endian.
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1920, 1080]);

  await panel.getByRole('button', { name: 'Back to the design' }).click();
  await expect(page.getByRole('group', { name: 'Theme' })).toBeVisible();
});
