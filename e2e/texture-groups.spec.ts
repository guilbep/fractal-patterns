import { expect, test } from '@playwright/test';

// Colors › Texture: the kinds sit in three weight groups, A+, A and B, inside one radio group.
test('Texture kinds are grouped by weight; arrows cross the groups', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('tab', { name: /^Colors/ }).click();
  const groups = page.locator('.texture-group').getByRole('group').filter({ has: page.locator('.grade-chip') });
  await expect(groups).toHaveCount(3);
  const expected = [
    ['A+', ['None', 'Grain', 'Sand', 'Riso', 'Terrazzo', 'Washi']],
    ['A', ['Linen', 'Plaster']],
    ['B', ['Stipple', 'Paper', 'Cold-press', 'Kraft']],
  ] as const;
  for (const [i, [grade, kinds]] of expected.entries()) {
    const g = groups.nth(i);
    await expect(g.locator('.grade-chip')).toHaveText(grade);
    const names = await g.getByRole('radio').evaluateAll((els) => els.map((e) => e.parentElement!.textContent!.trim()));
    expect(names).toEqual([...kinds]);
  }
  await expect(groups.nth(0).getByRole('radio', { name: 'Riso', exact: true })).toBeVisible();
  await expect(groups.nth(0).getByRole('radio', { name: 'Sand', exact: true })).toBeVisible();

  await groups.nth(0).getByRole('radio', { name: 'None', exact: true }).focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'Riso', exact: true })).toBeChecked();

  await page.setViewportSize({ width: 360, height: 740 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);
});
