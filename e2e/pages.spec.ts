import { expect, test } from '@playwright/test';

const pages = [
  { file: 'index.html', name: 'Patterns' },
  { file: 'studio.html', name: 'Studio' },
  { file: 'builder.html', name: 'Builder' },
];
const tools = [
  ['Patterns', 'index.html'],
  ['Studio', 'studio.html'],
  ['Builder', 'builder.html'],
] as const;
const sizes = [
  { width: 1280, height: 900 },
  { width: 360, height: 740 },
];

for (const p of pages)
  for (const size of sizes)
    test(`${p.name} at ${size.width} x ${size.height}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewportSize(size);
      await page.goto('/' + p.file);
      await page.waitForLoadState('networkidle');

      const nav = page.getByRole('navigation', { name: 'Tools' });
      const links = nav.getByRole('link');
      await expect(links).toHaveCount(3);
      for (const [name, file] of tools) {
        const link = nav.getByRole('link', { name: new RegExp(name) });
        const href = await link.evaluate((a) => new URL((a as HTMLAnchorElement).href).pathname);
        expect(href).toBe('/' + file);
        if (name === p.name) await expect(link).toHaveAttribute('aria-current', 'page');
        else await expect(link).not.toHaveAttribute('aria-current');
      }

      const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(scroll[0]).toBe(scroll[1]);
      expect(errors).toEqual([]);
    });
