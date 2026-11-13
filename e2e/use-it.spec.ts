import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('Use it: website background shows the export, a phone PNG has the chosen size', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Use it…' }).click();
  await expect(page.getByRole('tab', { name: 'Use it' })).toHaveAttribute('aria-selected', 'true');
  const panel = page.locator('#panel-use');
  await expect(panel.getByRole('radio', { name: /Website background/ })).toBeChecked();
  await expect(panel.getByRole('button', { name: 'Copy CSS' })).toBeVisible();

  await panel.getByText('Phone wallpaper').click();
  await panel.getByText('iPhone 17 Pro · 17 · 16 Pro').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Download PNG · 1206 × 2622' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-1206x2622\.png$/);
  const png = await readFile((await download.path())!);
  // PNG header: the IHDR width and height are bytes 16-23, big-endian.
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1206, 2622]);

  await panel.getByText('Website background').click();
  await expect(panel.getByRole('button', { name: 'Copy CSS' })).toBeVisible();
});
