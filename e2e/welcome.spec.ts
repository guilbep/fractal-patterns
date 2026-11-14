import { expect, test } from '@playwright/test';

const kindOf = (hash: string) => new URLSearchParams(hash.slice(1)).get('k') ?? 'tree';

// The first visit opens on the WELCOME design (share.ts); Reset and old links without k stay on Tree.
test('first visit shows Truchet, Reset returns to Tree, an old link without k is a Tree', async ({ page }) => {
  await page.goto('/index.html');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('k=truchet');
  await expect(page.getByText(/^Truchet · 96 px/)).toBeVisible();
  // The welcome colors are in no palette: the strip says Custom, not the default palette's name.
  await expect(page.getByRole('toolbar', { name: 'Design actions' }).getByText('Palette: Custom')).toBeVisible();

  await page.getByRole('button', { name: 'Reset', exact: true }).first().click();
  await expect.poll(async () => kindOf(await page.evaluate(() => location.hash))).toBe('tree');
  await expect(page.getByText(/^Tree · 120 px/)).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Design actions' }).getByText('Palette: Lagoon')).toBeVisible();

  for (const old of ['#s=7&v=1', '#k=tree&s=7']) {
    await page.goto('/index.html' + old);
    await page.reload();
    await expect(page.getByText(/^Tree · 120 px · seed 7/)).toBeVisible();
    expect(kindOf(await page.evaluate(() => location.hash))).toBe('tree');
  }
});
