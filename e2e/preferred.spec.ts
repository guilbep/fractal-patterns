import { expect, test, type Page } from '@playwright/test';

// Choosing a kind applies its preferred stroke, depth, and Reduce repetition (src/preferred.ts); a link never does.
const stroke = (page: Page) => page.locator('output[for="stroke"]');
const depth = (page: Page) => page.locator('output[for="depth"]');
const card = (page: Page, tab: RegExp, name: string) => async () => {
  await page.getByRole('tab', { name: tab }).click();
  await page.locator('label.kind', { hasText: name }).click();
};

test('Preferred: Carpet then a symmetry card apply their values, and one Undo returns to Carpet', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/index.html');
  await expect(stroke(page)).toHaveText('5 px'); // the first visit: Truchet
  await card(page, /^Fractals/, 'Carpet')();
  await expect(stroke(page)).toHaveText('1 px');
  await expect(depth(page)).toHaveText('2 of 3');
  await page.getByRole('tab', { name: /^Repetition/ }).click();
  await expect(page.getByRole('switch', { name: 'Reduce repetition' })).toBeChecked();
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await page.waitForTimeout(400); // the history commits after a 300 ms pause
  await card(page, /^Symmetry/, 'p2 half turn')();
  await expect(stroke(page)).toHaveText('0.5 px');
  await expect(depth(page)).toHaveText('2 of 3');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('k'))).toBe('carpet');
  await expect(stroke(page)).toHaveText('1 px');
  await expect(depth(page)).toHaveText('2 of 3');
  await page.getByRole('tab', { name: /^Repetition/ }).click();
  await expect(page.getByRole('switch', { name: 'Reduce repetition' })).toBeChecked();
  expect(errors).toEqual([]);
});

// Old links open exactly as before: the global defaults (depth 8 clamped, stroke 2, Reduce repetition off). Kinds that can vary, so the switch shows.
for (const [hash, d] of [
  ['k=hex&s=1', '3 of 3'],
  ['k=carpet&s=7', '3 of 3'],
  ['k=brick&s=3', '8 of 8'],
] as const)
  test(`Preferred: the link #${hash} keeps the global defaults`, async ({ page }) => {
    await page.goto(`/index.html#${hash}`);
    await expect(stroke(page)).toHaveText('2 px');
    await expect(depth(page)).toHaveText(d);
    await page.getByRole('tab', { name: /^Repetition/ }).click();
    await expect(page.getByRole('switch', { name: 'Reduce repetition' })).not.toBeChecked();
  });
