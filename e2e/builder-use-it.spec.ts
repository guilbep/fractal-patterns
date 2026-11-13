import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('Builder Use it: the export sits under Website background, a texture PNG has the chosen size', async ({ page }) => {
  await page.goto('/builder.html');
  await page.getByRole('button', { name: 'Start again' }).click();
  await page.getByRole('button', { name: 'Use it…' }).click();
  const panel = page.locator('.use-it-panel');
  await expect(panel.getByRole('radio', { name: /Website background/ })).toBeChecked();

  const [svgFile] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Download SVG' }).click()]);
  expect(svgFile.suggestedFilename()).toBe('pattern-builder.svg');
  expect((await readFile((await svgFile.path())!, 'utf8')).startsWith('<svg')).toBe(true);

  await panel.getByText('CSS and design file').click();
  const [json] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Download design (.json)' }).click()]);
  expect(json.suggestedFilename()).toBe('pattern-builder.json');
  expect(JSON.parse(await readFile((await json.path())!, 'utf8')).items).toHaveLength(16);

  await panel.getByText('Game & 3D texture').click();
  await panel.getByRole('radio', { name: /1024×1024/ }).check();
  const [png] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: /Download PNG/ }).click()]);
  expect(png.suggestedFilename()).toMatch(/-1024x1024\.png$/);
  const bytes = await readFile((await png.path())!);
  // PNG header: the IHDR width and height are bytes 16-23, big-endian.
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1024, 1024]);

  await page.getByRole('button', { name: 'Back to the design' }).click();
  await expect(page.getByRole('heading', { name: 'Shapes' })).toBeVisible();
});
