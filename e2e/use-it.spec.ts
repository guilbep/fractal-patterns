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

test('Use it: an iPhone PNG draws the tile at 3×, so a 320 px tile repeats every 960 px', async ({ page }) => {
  await page.goto('/index.html#k=sprigs&s=7&z=320');
  await page.getByRole('button', { name: 'Use it…' }).click();
  const panel = page.locator('#panel-use');
  await panel.getByText('Phone wallpaper').click();
  await panel.getByText('iPhone 17 Pro · 17 · 16 Pro').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Download PNG · 1206 × 2622' }).click(),
  ]);
  await expect(panel.getByRole('status')).toHaveText('Saved 1206 × 2622 PNG at 3×.');
  const b64 = (await readFile((await download.path())!)).toString('base64');
  // One row low in the image, under the clock fade: the pixel at x matches x + 960, and not always x + 320.
  const { same960, same320 } = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const cv = new OffscreenCanvas(img.width, 1);
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(img, 0, -2000);
    const d = ctx.getImageData(0, 0, img.width, 1).data;
    const eq = (a: number, b: number) => [0, 1, 2, 3].every((i) => d[a * 4 + i] === d[b * 4 + i]);
    let same960 = true;
    let same320 = true;
    for (let x = 0; x + 960 < img.width; x++) {
      if (!eq(x, x + 960)) same960 = false;
      if (!eq(x, x + 320)) same320 = false;
    }
    return { same960, same320 };
  }, `data:image/png;base64,${b64}`);
  expect(same960).toBe(true);
  expect(same320).toBe(false);
});

test('Use it: a phone from the list sets the size and the density; Custom keeps both', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Use it…' }).click();
  const panel = page.locator('#panel-use');
  await panel.getByText('Phone wallpaper').click();
  await expect(panel.getByText('Android sizes are approximate. On that phone, use This phone.')).toBeVisible();
  await panel.getByLabel('Choose your phone').selectOption({ label: 'Samsung Galaxy S25 · approx.' });
  await expect(panel.getByText('1080 × 2340 · 3×')).toBeVisible();
  await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Download PNG · 1080 × 2340' }).click()]);
  await expect(panel.getByRole('status')).toHaveText('Saved 1080 × 2340 PNG at 3×.');
  await panel.getByLabel('Choose your phone').selectOption({ label: 'Google Pixel 9 · approx.' });
  await expect(panel.getByText('1080 × 2424 · 2.625×')).toBeVisible();
  await panel.getByText('Custom size…').click();
  await expect(panel.getByRole('radiogroup', { name: 'Pixel density' }).getByRole('radio', { name: '2.625×' })).toBeChecked();
  await expect(panel.getByRole('button', { name: 'Download PNG · 1080 × 2424' })).toBeVisible();
});

test('Use it on a desktop: no "This phone (detected)"; the phone list starts with the iPhones', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Use it…' }).click();
  const panel = page.locator('#panel-use');
  await panel.getByText('Phone wallpaper').click();
  await expect(panel.getByRole('radio', { name: /iPhone 17 Pro · 17/ })).toBeChecked();
  await expect(panel.getByText('This phone (detected)')).toHaveCount(0);
  await panel.getByText('Desktop wallpaper').click();
  await expect(panel.getByRole('radio', { name: /This screen \(detected\)/ })).toBeChecked();
});

test.describe('on a phone', () => {
  // The screen too: the Desktop Chrome project reports a 1920 × 1080 screen, a real phone its own size.
  test.use({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  test('Use it: "This phone (detected)" is shown and checked, at 1170 × 2532 and 3×', async ({ page }) => {
    await page.goto('/index.html');
    await page.locator('.bottom-bar').getByRole('button', { name: 'Use it', exact: true }).tap();
    const sheet = page.getByRole('dialog', { name: 'Use it' });
    await sheet.locator('.use-it-dest', { hasText: 'Phone wallpaper' }).tap();
    await expect(sheet.getByRole('radio', { name: /This phone \(detected\)/ })).toBeChecked();
    await expect(sheet.getByRole('button', { name: 'Download PNG · 1170 × 2532' })).toBeVisible();
    await sheet.locator('.use-it-dest', { hasText: 'Desktop wallpaper' }).tap();
    await expect(sheet.getByText('This screen (detected)')).toHaveCount(0);
    // Custom keeps the density of the preset before it: the first desktop preset here, MacBook Pro 14″, is 2×.
    await sheet.getByText('Custom size…').tap();
    await expect(sheet.getByRole('radiogroup', { name: 'Pixel density' }).getByRole('radio', { name: '2×' })).toBeChecked();
  });
});
