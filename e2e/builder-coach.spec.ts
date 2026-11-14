import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/builder.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Builder coach: three steps, Done hides it for good', async ({ page }) => {
  const coach = page.getByRole('dialog', { name: 'Builder tour' });
  await expect(coach).toContainText('Step 1 of 3 · The wrap');
  await expect(coach.getByRole('button', { name: 'Next: the handle' })).toBeFocused();
  await coach.getByRole('button', { name: 'Next: the handle' }).click();
  await coach.getByRole('button', { name: 'Next: the folds' }).click();
  await expect(coach).toContainText('Step 3 of 3 · The folds');
  await coach.getByRole('button', { name: 'Done' }).click();
  await expect(coach).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start again' })).toBeVisible();
  await expect(coach).toBeHidden();
});

test('Builder coach: Skip hides it and stores done', async ({ page }) => {
  const coach = page.getByRole('dialog', { name: 'Builder tour' });
  await coach.getByRole('button', { name: 'Skip' }).click();
  await expect(coach).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('fp-builder-coach-v1'))).toBe('done');
});
