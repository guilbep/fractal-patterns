import { expect, test } from '@playwright/test';

const heroImage = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before').backgroundImage);

test('Turing stripes: the hero shows a tile, no console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/index.html#k=turing-stripes&s=1');
  await expect.poll(() => heroImage(page)).toContain('data:image/svg+xml');
  await expect.poll(() => heroImage(page)).toContain('path');
  expect(errors).toEqual([]);
});

test('Coral at depth 4 grows in the worker: Growing…, then the tile, no long task', async ({ page }) => {
  await page.goto('/index.html#k=coral&s=1&d=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await expect(page.locator('#grow-status')).toHaveText('');
  await expect.poll(() => heroImage(page)).toContain('path');
  const before = await heroImage(page);
  await page.evaluate(() => {
    const w = window as unknown as { longTasks: number[]; statuses: string[] };
    w.longTasks = [];
    w.statuses = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => w.longTasks.push(e.duration))).observe({ type: 'longtask' });
    const status = document.querySelector('#grow-status')!;
    new MutationObserver(() => w.statuses.push(status.textContent ?? '')).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.locator('#depth').fill('4');
  await expect(page.locator('output[for="depth"]')).toHaveText('4 of 4');
  await expect.poll(() => heroImage(page)).not.toBe(before);
  await expect(page.locator('#grow-status')).toHaveText('');
  const { longTasks, statuses } = await page.evaluate(() => {
    const w = window as unknown as { longTasks: number[]; statuses: string[] };
    return { longTasks: w.longTasks, statuses: w.statuses };
  });
  expect(statuses).toContain('Growing…');
  expect(longTasks.filter((d) => d > 50)).toEqual([]);
});
