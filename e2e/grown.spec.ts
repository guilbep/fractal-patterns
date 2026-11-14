import { expect, test } from '@playwright/test';

// The grown kinds (Turing stripes and spots, coral, frost) draw only in the heavy worker: on the page's main thread a
// direct call gives an empty tile. Each caller that asks directly must show something, or say why not.

const faviconSvg = (href: string | null): string => {
  const [head, body = ''] = (href ?? '').split(',', 2);
  return head!.endsWith(';base64') ? atob(body) : decodeURIComponent(body);
};

test('a grown kind: the favicon is a drawn SVG, not an empty square', async ({ page }) => {
  await page.goto('/index.html#k=coral&s=1');
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute('href', /^data:image\/svg\+xml/);
  await expect.poll(async () => faviconSvg(await icon.getAttribute('href'))).toMatch(/<path[^>]* d=['"]M/);
});

test('a grown kind: Patchwork says why it is off', async ({ page }) => {
  await page.goto('/index.html#k=coral&s=1');
  await page.getByRole('tab', { name: 'Pattern', exact: true }).click();
  await page.locator('details.lib-patchwork > summary').click();
  await expect(page.getByText('Patchwork mixes quick patterns; this one grows in the background.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Patchwork' })).toBeDisabled();
});

test('Builder Math patterns: no blank stamp, and the grown kinds are named as left out', async ({ page }) => {
  await page.goto('/builder.html');
  const fold = page.locator('details.fold', { hasText: 'Math patterns' });
  await fold.locator('summary').click();
  await page.locator('#math-family').selectOption({ label: 'Themes' });
  await expect(page.getByText('Grown patterns (Turing, Coral, Frost) are not offered as stamps yet.')).toBeVisible();
  const buttons = fold.locator('.stamp-grid .stamp-btn');
  await expect(buttons.first()).toBeVisible();
  const ds = await buttons.locator('path').evaluateAll((ps) => ps.map((p) => p.getAttribute('d') ?? ''));
  expect(ds.length).toBeGreaterThan(0);
  for (const d of ds) expect(d).toMatch(/^M/);
  await expect(fold.locator('.stamp-btn[aria-label="Coral"]')).toHaveCount(0);
});
