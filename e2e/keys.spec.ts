import { expect, test, type Page } from '@playwright/test';

async function openKeys(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
}

async function closesToButton(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toBeFocused();
}

for (const [file, key] of [
  ['studio.html', 'R'],
  ['builder.html', 'N / P'],
] as const) {
  test(`key panel on ${file}`, async ({ page }) => {
    await page.goto('/' + file);
    await openKeys(page);
    await expect(page.getByRole('dialog').getByRole('rowheader', { name: key, exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('switch')).toHaveCount(file === 'builder.html' ? 0 : 1);
    await closesToButton(page);
  });
}

test('key panel on Patterns holds the shortcut switch', async ({ page }) => {
  await page.goto('/index.html');
  await openKeys(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('rowheader', { name: 'R', exact: true })).toBeVisible();
  const sw = dialog.getByRole('switch', { name: /Keyboard shortcuts: R shuffles/ });
  await expect(sw).toBeChecked();
  await sw.click();
  await expect(sw).not.toBeChecked();
  await closesToButton(page);

  const seed = page.locator('#seed');
  const before = await seed.inputValue();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('r');
  await expect(seed).toHaveValue(before);

  await page.reload();
  await openKeys(page);
  await expect(page.getByRole('dialog').getByRole('switch')).not.toBeChecked();
  await page.getByRole('dialog').getByRole('switch').click();
  await expect(page.getByRole('dialog').getByRole('switch')).toBeChecked();
});
