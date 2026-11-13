// Page speed (make perf): serves dist with `vite preview`, runs Lighthouse's
// mobile run (a slow 4G and a 4x slower CPU, simulated) on each page, and
// prints the median of the runs as a Markdown table. Each raw run goes to stderr.
//   node perf/lighthouse.mjs [runs]
// Chrome: $CHROME_PATH, else Playwright's Chromium, else Lighthouse's own lookup.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const pages = { Patterns: '/index.html', Studio: '/studio.html' };

const runs = Number(process.argv[2] ?? 3);
const port = '18493';
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env };
if (!env.CHROME_PATH && existsSync(chromium.executablePath())) env.CHROME_PATH = chromium.executablePath();
console.error(`chrome: ${env.CHROME_PATH ?? "Lighthouse's own lookup"}`);

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { stdio: ['ignore', 'ignore', 'inherit'], detached: true });
// Kill the whole group: npx, and the vite under it.
const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {}
};
process.on('exit', stop);

// Each column: [heading, audit or score, decimals].
const columns = [
  ['Score', (r) => r.categories.performance.score * 100, 0],
  ['FCP ms', (r) => r.audits['first-contentful-paint'].numericValue, 0],
  ['LCP ms', (r) => r.audits['largest-contentful-paint'].numericValue, 0],
  ['TBT ms', (r) => r.audits['total-blocking-time'].numericValue, 0],
  ['CLS', (r) => r.audits['cumulative-layout-shift'].numericValue, 3],
  ['Bytes', (r) => r.audits['total-byte-weight'].numericValue, 0],
  ['Script eval ms', (r) => r.audits['bootup-time'].numericValue, 0],
];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base + '/')).ok) break;
    } catch {}
    if (i > 300) throw new Error(`vite preview didn't answer on ${base}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  const out = mkdtempSync(join(tmpdir(), 'perf-'));
  const rows = [];
  for (const [name, path] of Object.entries(pages)) {
    const values = columns.map(() => []);
    for (let r = 0; r < runs; r++) {
      const file = join(out, `${name}-${r}.json`);
      execFileSync('npx', ['-y', 'lighthouse@12.6.1', base + path, '--only-categories=performance', '--output=json', `--output-path=${file}`, '--chrome-flags=--headless=new', '--quiet'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
      const report = JSON.parse(readFileSync(file, 'utf8'));
      const run = columns.map(([h, get, d], c) => {
        values[c].push(get(report));
        return `${h}=${get(report).toFixed(d)}`;
      });
      console.error(`${name} run ${r + 1}: ${run.join(' ')}`);
    }
    rows.push(`| ${name} | ${columns.map(([, , d], c) => median(values[c]).toFixed(d)).join(' | ')} |`);
  }
  rmSync(out, { recursive: true, force: true });
  console.log(`Median of ${runs} Lighthouse mobile runs:\n`);
  console.log(`| Page | ${columns.map(([h]) => h).join(' | ')} |`);
  console.log(`|---|${columns.map(() => '---:').join('|')}|`);
  for (const row of rows) console.log(row);
} finally {
  stop();
}
