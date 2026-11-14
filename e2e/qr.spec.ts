import { expect, test } from '@playwright/test';

test('Send to my phone: a QR code of the link with use=<destination>; Esc closes it, focus goes back', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Use it…' }).click();
  const panel = page.locator('#panel-use');
  await panel.getByText('Phone wallpaper').click();
  const button = panel.getByRole('button', { name: 'Send to my phone (QR)' });
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Send to my phone' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('svg title')).toHaveText("QR code for this design's link");
  const box = await dialog.locator('.qr-code svg').boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(220);
  await expect(dialog.getByRole('textbox', { name: 'Link' })).toHaveValue(/#k=.*&use=phone$/);
  await expect(dialog.getByText('Scan with your phone camera.', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('A link with use=phone opens Use it on Phone wallpaper, then leaves the address', async ({ page }) => {
  await page.goto('/index.html#k=tree&s=7&use=phone');
  await expect(page.getByRole('tab', { name: 'Use it' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-use').getByRole('radio', { name: /Phone wallpaper/ })).toBeChecked();
  expect(page.url()).not.toContain('use=');
  expect(page.url()).toContain('s=7'); // tree is the default kind, so the clean link leaves k out
});

test('Studio: the link carries the design and use=; Builder: no link yet, the reason is shown', async ({ page }) => {
  await page.goto('/studio.html');
  await page.getByRole('button', { name: 'Use it…' }).first().click();
  await page.locator('.use-it-dest', { hasText: 'Phone wallpaper' }).click();
  await page.getByRole('button', { name: 'Send to my phone (QR)' }).click();
  await expect(page.getByRole('dialog', { name: 'Send to my phone' }).getByRole('textbox', { name: 'Link' })).toHaveValue(
    /studio\.html#.*&use=phone$/,
  );
  await page.keyboard.press('Escape');
  // Esc closed only the dialog: the Use it view stays.
  await expect(page.getByRole('button', { name: 'Send to my phone (QR)' })).toBeVisible();

  await page.goto('/builder.html');
  await page.getByRole('button', { name: 'Use it…' }).first().click();
  await page.locator('.use-it-dest', { hasText: 'Phone wallpaper' }).click();
  await expect(page.getByRole('button', { name: 'Send to my phone (QR)' })).toBeDisabled();
  await expect(page.getByText('This page has no link for the design yet.')).toBeVisible();
});

test('Studio: a link with use=phone opens the Use it view and leaves the address', async ({ page }) => {
  await page.goto('/studio.html#s=7&use=phone');
  await expect(page.locator('.use-it-dest', { hasText: 'Phone wallpaper' }).getByRole('radio')).toBeChecked();
  expect(page.url()).not.toContain('use=');
});
