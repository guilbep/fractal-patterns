import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const BASE = 'https://guilbep.github.io/fractal-patterns/';

for (const page of ['index.html', 'studio.html']) {
  test(`${page} has the search and social tags`, () => {
    const html = read(page);
    const attr = (re: RegExp) => html.match(re)?.[1] ?? '';
    const title = attr(/<title>([^<]*)<\/title>/);
    assert.ok(title.length >= 10 && title.length <= 60, title);
    const desc = attr(/<meta name="description" content="([^"]*)"/);
    assert.ok(desc.length >= 120 && desc.length <= 160, `${desc.length}`);
    assert.ok(attr(/<link rel="canonical" href="([^"]*)"/).startsWith(BASE));
    assert.match(attr(/<meta property="og:image" content="([^"]*)"/), /^https:\/\//);
    const ld = JSON.parse(attr(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/));
    assert.equal(ld['@type'], 'WebApplication');
  });
}

test('robots, sitemap and funding', () => {
  assert.match(read('public/robots.txt'), /^Sitemap: https:\/\/guilbep\.github\.io\/fractal-patterns\/sitemap\.xml$/m);
  const sitemap = read('public/sitemap.xml');
  assert.ok(sitemap.includes(`<loc>${BASE}</loc>`));
  assert.ok(sitemap.includes(`<loc>${BASE}studio.html</loc>`));
  assert.equal(read('.github/FUNDING.yml'), 'github: guilbep\n');
});
