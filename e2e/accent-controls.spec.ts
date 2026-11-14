import { expect, test, type Page } from '@playwright/test';

// The preview is the exported .fp-pattern class: its ::before carries the backgrounds, accent on top.
const layer = (page: Page) =>
  page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before');
    return { image: s.backgroundImage, size: s.backgroundSize };
  });
const urls = (s: string) => s.split('url(').length - 1;

test('Pattern › Accent shapes: the switch, Ring, On a grid and Snap 4 reach the link and the preview', async ({ page }) => {
  await page.goto('/index.html#k=hex&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await page.getByRole('heading', { name: 'Accent shapes' }).click();
  const ring = page.getByRole('button', { name: 'Ring', exact: true });
  await expect(ring).toBeDisabled();
  await page.getByRole('switch', { name: 'Show accent shapes' }).click();
  await expect(page).toHaveURL(/al=/);
  await ring.click();
  await expect(ring).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Where').selectOption({ label: 'On a grid' });
  await page.getByRole('radio', { name: '4', exact: true }).click();
  await expect(page).toHaveURL(/al=1_r_15_100_g_4/);
  await expect.poll(async () => urls((await layer(page)).image)).toBe(2);
});

test('Repetition on Truchet: only the accent varies, over a 576 px super tile above the 96 px tile', async ({ page }) => {
  await page.goto('/index.html#k=truchet&s=7&d=4&z=96&w=5');
  await page.getByRole('tab', { name: /^Repetition/ }).click();
  const sw = page.getByRole('switch', { name: 'Reduce repetition' });
  await expect(sw).toBeVisible();
  const applies = page.getByRole('radiogroup', { name: 'Applies to' });
  await expect(applies.getByRole('radio', { name: 'Base' })).toBeDisabled();
  await expect(page.getByText('This pattern must meet at every tile edge')).toBeVisible();
  await sw.check();
  await expect(applies.getByRole('radio', { name: 'Accent' })).toHaveAttribute('aria-checked', 'true');
  await expect(page).toHaveURL(/av=a_6_35_50_28_0/);
  await expect.poll(async () => (await layer(page)).size).toContain('576px');
  await expect(page.locator('#av-period')).toContainText('576 px');
  const w = await page.locator('.one-tile').evaluate((el) => el.getBoundingClientRect().width);
  expect(w).toBe(96);
});
