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

test('Patterns on a phone: the six tabs are a 3 × 2 grid with arrow keys in reading order', async ({ page }) => {
  await page.goto('/index.html');
  const tabs = page.getByRole('tablist', { name: 'Controls' }).getByRole('tab');
  await expect(tabs).toHaveCount(6);
  const y1 = (await tabs.nth(0).boundingBox())!.y;
  const y3 = (await tabs.nth(2).boundingBox())!.y;
  const y4 = (await tabs.nth(3).boundingBox())!.y;
  expect(y3).toBe(y1);
  expect(y4).toBeGreaterThan(y1 + 30);
  const pattern = page.getByRole('tab', { name: 'Pattern' });
  await pattern.click();
  await page.keyboard.press('ArrowRight');
  const repetition = page.getByRole('tab', { name: /^Repetition/ });
  await expect(repetition).toBeFocused();
  await expect(repetition).toHaveAttribute('aria-selected', 'true');
  // Down steps in reading order too (Repetition, then Layout); Up goes back.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(repetition).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Use it' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Use it' })).toBeFocused();
});

for (const file of ['index.html', 'studio.html', 'builder.html'])
  test(`${file} on a phone: the preview is about 270 px, then a 150 px strip once the page scrolls into the controls`, async ({ page }) => {
    await page.goto('/' + file);
    // The part of the preview on screen (the stage is sticky; the header scrolls away above it).
    const visible = () =>
      page.evaluate(() => {
        const r = document.querySelector('.stage')!.getBoundingClientRect();
        return Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      });
    const start = await visible();
    expect(start).toBeGreaterThanOrEqual(250);
    expect(start).toBeLessThanOrEqual(290);
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect.poll(visible).toBeGreaterThanOrEqual(130);
    await expect.poll(visible).toBeLessThanOrEqual(170);
    // The full screen button stays in the corner of the strip (the Builder has none).
    if (file !== 'builder.html') await expect(page.getByRole('button', { name: 'Full screen' })).toBeInViewport();
  });
