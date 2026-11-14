import { expect, test } from '@playwright/test';

test('Precision loupe: rounding to 0 decimals moves the lines, 3 decimals nearly matches the exact lines', async ({ page }) => {
  await page.goto('/index.html#k=koch&s=1');
  await page.getByRole('button', { name: 'Use it…' }).click();
  const panel = page.locator('#panel-use');
  await expect(panel.getByRole('radio', { name: /Website background/ })).toBeChecked();
  const loupe = panel.locator('svg.loupe-view');
  await expect(loupe).toHaveAttribute('role', 'img');
  await expect(loupe.locator('path')).toHaveCount(2);
  const readout = panel.locator('.loupe-readout');
  const shift = async () => Number((await readout.textContent())!.match(/move up to ([\d.]+) px/)![1]);
  const paths = () =>
    loupe.evaluate((svg) => [...svg.querySelectorAll('path')].map((p) => ({ d: p.getAttribute('d') ?? '', len: p.getTotalLength() })));

  const precision = panel.locator('#precision');
  await precision.fill('3');
  await expect(readout).toContainText('Precision 3:');
  const fine = await shift();
  const [e3, r3] = await paths();
  expect(e3!.d).not.toBe('');
  expect(Math.abs(r3!.len - e3!.len) / e3!.len).toBeLessThan(0.001);

  await precision.fill('0');
  await expect(readout).toContainText('Precision 0:');
  expect(await shift()).toBeGreaterThan(fine);
  const [e0, r0] = await paths();
  expect(r0!.d).not.toBe(e0!.d);
  expect(Math.abs(r0!.len - e0!.len)).toBeGreaterThan(Math.abs(r3!.len - e3!.len));
  await expect(loupe).toHaveAttribute('aria-label', /lines move up to/);
});
