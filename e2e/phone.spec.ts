import { expect, test } from '@playwright/test';

// Phones: the fixed bottom bar replaces the toolbar (design boards Mobile-*).
test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const cells = {
  'index.html': ['Shuffle', 'Undo', 'Redo', 'Palette', 'Use it'],
  'studio.html': ['Shuffle', 'Undo', 'Redo', 'Palette', 'Use it'],
  'builder.html': ['Undo', 'Redo', 'Start again', 'Examples', 'Use it'],
};

for (const [file, names] of Object.entries(cells))
  test(`${file} on a phone: the bottom bar has its five cells and the page does not scroll sideways`, async ({ page }) => {
    await page.goto('/' + file);
    const bar = page.locator('.bottom-bar');
    await expect(bar).toBeVisible();
    await expect(bar.locator('> *')).toHaveCount(5);
    for (const name of names) {
      const cell = name === 'Examples' ? bar.getByRole('combobox', { name }) : bar.getByRole('button', { name, exact: true });
      await expect(cell).toBeVisible();
    }
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBe(cw);
  });

test('Patterns on a phone: Shuffle, the palette sheet, its More items and Use it', async ({ page }) => {
  await page.goto('/index.html');
  const bar = page.locator('.bottom-bar');
  const seed = page.locator('.hero-caption .visually-hidden');
  const before = await seed.textContent();
  await bar.getByRole('button', { name: 'Shuffle' }).tap();
  await expect(seed).not.toHaveText(before ?? '');

  const paletteCell = bar.getByRole('button', { name: 'Palette' });
  await paletteCell.tap();
  const sheet = page.getByRole('dialog', { name: 'Palette' });
  await expect(sheet).toBeVisible();
  const name = sheet.locator('.palette-name');
  const first = await name.textContent();
  await sheet.getByRole('button', { name: 'Next palette' }).tap();
  await expect(name).not.toHaveText(first ?? '');
  // Copy CSS and Copy link live in the sheet's More group on phones.
  for (const label of ['Random pattern', 'Reset', 'Copy CSS', 'Copy link'])
    await expect(sheet.getByRole('button', { name: label })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(paletteCell).toBeFocused();

  await bar.getByRole('button', { name: 'Use it', exact: true }).tap();
  await expect(page.getByRole('tab', { name: 'Use it' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-use')).toBeVisible();
});

test('Studio and Builder on a phone: Use it opens the Use it view', async ({ page }) => {
  for (const file of ['studio.html', 'builder.html']) {
    await page.goto('/' + file);
    await page.locator('.bottom-bar').getByRole('button', { name: 'Use it', exact: true }).tap();
    await expect(page.locator('.controls .use-it-panel')).toBeVisible();
  }
});
