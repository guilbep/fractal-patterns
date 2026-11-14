import { expect, test } from '@playwright/test';

// The phone Colors tab (design board Mobile-Sheet): role rows, the compact contrast box and the Details toggle.
test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('Colors tab on a phone: role rows, dots, contrast box and Details', async ({ page }) => {
    await page.goto('/index.html');
    // A palette gives the rows their dots.
    await page.locator('.bottom-bar').getByRole('button', { name: 'Palette' }).tap();
    await page.getByRole('dialog', { name: 'Palette' }).getByRole('button', { name: 'Next palette' }).tap();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Colors' }).tap();

    const row = (name: string) => page.locator('.rl-head', { hasText: new RegExp(`^${name}\\b`) });
    for (const name of ['Background', 'Pattern', 'Text']) await expect(row(name)).toBeVisible();
    await expect(row('Background')).toContainText(/#[0-9A-F]{6}/);

    await expect(page.locator('#background-hex')).toBeHidden();
    await row('Background').tap();
    await expect(row('Background')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#background-hex')).toBeVisible();

    const textHex = row('Text').locator('.rl-hex');
    const before = await textHex.textContent();
    await page
      .locator('.rl-line', { has: row('Text') })
      .locator('.rl-dot[aria-pressed="false"]:enabled')
      .first()
      .tap();
    await expect(textHex).not.toHaveText(before ?? '');

    await expect(page.locator('.cp-box-num')).toHaveText(/^\d+\.\d:1$/);

    const details = page.getByRole('button', { name: 'Details · APCA, color vision' });
    await expect(page.getByRole('heading', { name: 'Second opinion' })).toBeHidden();
    await details.tap();
    await expect(details).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('heading', { name: 'Second opinion' })).toBeVisible();

    const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
    expect(ids.length).toBe(new Set(ids).size);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBe(cw);
  });
});

test('Colors tab on a desktop: no phone role rows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/index.html');
  await page.getByRole('tab', { name: 'Colors' }).click();
  await expect(page.locator('#background-hex')).toBeVisible();
  await expect(page.locator('.rl-line').first()).toBeHidden();
  await expect(page.getByRole('button', { name: 'Details · APCA, color vision' })).toBeHidden();
});
