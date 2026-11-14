import { expect, test } from '@playwright/test';

for (const path of ['/', '/studio.html', '/builder.html'])
  test(`the footer shows the footprint of ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('.page-footprint')).toHaveText(/This page so far: ≈ [\d.]+ mg CO₂ \/ visit · [\d.]+ KB compressed\./);
  });
