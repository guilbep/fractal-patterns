import { expect, test } from '@playwright/test';

// The preview is the exported .fp-pattern class: its ::before carries the backgrounds.
const heroBg = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.hero.fp-pattern')!, '::before').backgroundImage);
// The tile is an SVG holding the image: inside the CSS url() the data URL type is percent-encoded or plain.
const IMAGE = /image(\/|%2F)(webp|png)/i;

test('Color symmetry › Smooth wheel: an image tile grown off the main thread', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as unknown as { longTasks: { start: number; duration: number }[] }).longTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        (window as unknown as { longTasks: { start: number; duration: number }[] }).longTasks.push({ start: e.startTime, duration: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  });

  await page.goto('/index.html#k=p4m&s=5&cs=1&cm=w');
  await expect.poll(() => heroBg(page), { timeout: 5000 }).toMatch(IMAGE);
  const tip = await page.locator('.size-tip').first().textContent();
  expect(tip).toContain('image');

  // A new recipe asks the worker for a new wheel: no main-thread task over 50 ms while it grows.
  await page.getByRole('tab', { name: 'Pattern' }).click();
  const before = await heroBg(page);
  await page.getByRole('button', { name: 'New recipe' }).click();
  // The window starts one frame after the click: the redraw that every design change does (Lines included) is not
  // part of the wheel's growth, and on a slow runner it alone can pass 50 ms (measured: 52–63 ms at 2× CPU for a Lines
  // Shuffle). What this test checks is that growing the wheel in the worker adds no long task.
  const t0 = await page.evaluate(() => new Promise<number>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))));
  await expect.poll(() => heroBg(page), { timeout: 5000 }).not.toBe(before);
  await expect.poll(() => heroBg(page), { timeout: 5000 }).toMatch(IMAGE);
  await expect(page.getByRole('status').filter({ hasText: 'Growing' })).toHaveCount(0);
  const long = await page.evaluate(
    (t) => (window as unknown as { longTasks: { start: number; duration: number }[] }).longTasks.filter((e) => e.start >= t && e.duration > 50),
    t0,
  );
  expect(long).toEqual([]);
  expect(errors).toEqual([]);
});
