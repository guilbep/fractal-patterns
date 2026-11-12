// One pasteable export: the .fp-pattern class with custom properties, the optional plate, usage, and a tile-switching script.
import { cssPlate, svgToDataUri } from './css.ts';
import { repeatDistance } from './layers.ts';
import { motionLayer, scaledSize, type Motion } from './motion.ts';

export interface ExportInput {
  readonly svg: string;
  readonly tileSize: number; // px, repeat distance before the motion scale
  readonly background: string;
  readonly text: string;
  readonly plate: {
    readonly mode: 'plate' | 'split' | 'direct';
    readonly opacity: number;
    readonly radius: number;
    readonly blur: number;
  };
  readonly motion: Motion;
  readonly label: string; // how to make the tile again, e.g. "Herringbone, seed 123, depth 3"
  readonly appName: string;
  readonly second?: { readonly svg: string; readonly tileSize: number }; // a second layer, its size coprime with tileSize
}

// Inserting a space breaks every comment delimiter and cannot create a new one.
const safe = (s: string) => s.replaceAll('*/', '* /').replaceAll('/*', '/ *');

export function exportCss(i: ExportInput): string {
  const drifting = i.motion.drift !== 'none';
  const plated = i.plate.mode !== 'direct';
  const size = scaledSize(i.tileSize, i.motion);
  const size2 = i.second ? scaledSize(i.second.tileSize, i.motion) : '';
  return [
    `/* ${safe(i.appName)}: ${safe(i.label)}. Tile ${i.tileSize}px. */`,
    '.fp-pattern {',
    `  --fp-bg: ${i.background};`,
    `  --fp-ink: ${i.text};`,
    `  --fp-tile: url("${svgToDataUri(i.svg)}");`,
    `  --fp-size: ${size}px;`,
    ...(i.second ? [`  --fp-tile-2: url("${svgToDataUri(i.second.svg)}");`, `  --fp-size-2: ${size2}px;`] : []),
    '  position: relative;',
    '  isolation: isolate;',
    '  overflow: hidden;',
    '  background-color: var(--fp-bg);',
    '  color: var(--fp-ink);',
    '}',
    ...motionLayer(
      i.motion,
      'var(--fp-tile)',
      'var(--fp-size)',
      i.second ? { image: 'var(--fp-tile-2)', s: 'var(--fp-size-2)' } : undefined,
    ),
    ...(plated ? ['', cssPlate(i.background, i.plate)] : []),
    '',
    '/* Use: put class="fp-pattern" on the element that shows the pattern.',
    ...(plated ? [' * Put class="fp-plate" on the element that holds the text.'] : []),
    ...(drifting ? [' * Add the class fp-paused to pause the motion.'] : []),
    ...(i.second ? [` * This pattern has two layers. It repeats exactly every ${repeatDistance(Number(size), Number(size2))} px.`] : []),
    ' */',
  ].join('\n');
}

export function exportJs(tiles: readonly string[], event: 'click' | 'load'): string {
  // JSON-encoded, and '<' escaped so the text can sit inside a <script> element.
  const list = JSON.stringify(tiles.map((t) => `url("${svgToDataUri(t)}")`)).replaceAll('<', '\\u003c');
  const body =
    event === 'click'
      ? [
          '  els.forEach(function (el) {',
          '    var k = 0;',
          "    el.addEventListener('click', function () {",
          '      k = (k + 1) % tiles.length;',
          "      el.style.setProperty('--fp-tile', tiles[k]);",
          '    });',
          '  });',
        ]
      : [
          '  var tile = tiles[Math.floor(Math.random() * tiles.length)];',
          '  els.forEach(function (el) {',
          "    el.style.setProperty('--fp-tile', tile);",
          '  });',
        ];
  return [
    '// Changes the pattern tile. Works with the .fp-pattern CSS above.',
    '(function () {',
    `  var tiles = ${list};`,
    '  if (tiles.length === 0) return;',
    "  var els = Array.prototype.slice.call(document.querySelectorAll('.fp-pattern'));",
    ...body,
    '})();',
  ].join('\n');
}

export function exportHtml(): string {
  return ['<section class="fp-pattern">', '  <p class="fp-plate">Your text</p>', '</section>'].join('\n');
}
