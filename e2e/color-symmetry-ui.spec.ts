import { expect, test } from '@playwright/test';

test('Pattern › Color symmetry: the switch shows its controls on a symmetry kind', async ({ page }) => {
  await page.goto('/index.html#k=p4m&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  const mode = page.getByRole('radiogroup', { name: 'Draw the group with' });
  const lines = mode.getByRole('radio', { name: 'Lines' });
  const color = mode.getByRole('radio', { name: 'Color symmetry' });
  await expect(lines).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel(/^Waves/)).toBeHidden();

  // Keyboard: the arrow key moves to Color symmetry.
  await lines.focus();
  await page.keyboard.press('ArrowRight');
  await expect(color).toHaveAttribute('aria-checked', 'true');
  await expect(color).toBeFocused();

  const waves = page.getByLabel(/^Waves/);
  await expect(waves).toBeVisible();
  await expect(page.getByLabel(/^Detail/)).toBeVisible();
  await expect(page.getByRole('group', { name: /Color order/ })).toBeVisible();
  await expect(page.getByLabel('Balance color areas')).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Render' })).toBeVisible();

  await waves.fill('3');
  await expect(page.locator('output[for="cs-waves"]')).toHaveText('3');

  const seed = page.locator('#seed');
  const before = await seed.inputValue();
  await page.getByRole('button', { name: 'New recipe' }).click();
  await expect(seed).not.toHaveValue(before);

  await page.getByRole('button', { name: 'Next color order' }).click();
  await expect(page.getByRole('group', { name: /Color order/ })).toContainText('2 of 10');

  await page.getByRole('radio', { name: 'Smooth wheel · WebP image' }).click();
  await expect(page.getByText('An image tile: heavier than bands')).toBeVisible();

  await lines.click();
  await expect(waves).toBeHidden();
  await expect(page.getByRole('button', { name: 'New recipe' })).toBeHidden();
});

test('Pattern › Color symmetry: no switch on a tree', async ({ page }) => {
  await page.goto('/index.html#k=tree&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Lines' })).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Draw the group with' })).toHaveCount(0);
});
