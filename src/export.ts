// One pasteable export: the .fp-pattern class with custom properties, the optional plate, usage, and a tile-switching script.
import { cssPlate, svgToDataUri } from './css.ts';
import { changeMask, fadeMask, type ChangeDir } from './fade.ts';
import { repeatDistance, type Layer2Settings } from './layers.ts';
import { motionLayer, parallaxBlock, scaledSize, type Motion } from './motion.ts';

export interface ExportInput {
  readonly svg: string;
  readonly tileSize: number; // px, repeat distance before the motion scale (the width of a rectangular tile)
  readonly tileHeight?: number; // px, the height of a rectangular tile; absent = square
  readonly background: string;
  readonly text: string;
  readonly plate: {
    readonly mode: 'plate' | 'split' | 'direct';
    readonly opacity: number;
    readonly radius: number;
    readonly blur: number;
  };
  readonly motion: Motion;
  readonly source?: string; // the address of the tool, written into the first comment so the CSS says where it came from
  readonly label: string; // how to make the tile again, e.g. "Herringbone, seed 123, depth 3"
  readonly appName: string;
  // A second layer, its size coprime with tileSize, with its own offset, extra rotation, opacity, and depth (see motionLayer).
  readonly second?: { readonly svg: string; readonly tileSize: number; readonly tileHeight?: number } & Partial<Layer2Settings>;
  readonly fade?: boolean; // a soft mask over the pattern layer(s)
  // Slow change across the page: a linear-gradient mask from full strength to `to` alpha. It only lowers the
  // pattern's alpha, so the worst case for text stays the full-strength end and the contrast check needs no change.
  readonly change?: { readonly dir: ChangeDir; readonly to: number };
  readonly parallax?: boolean; // the two layers move at different speeds on scroll; needs `second`
  readonly sections?: boolean; // helper classes fp-a, fp-b, fp-c that turn the pattern per section
}

// The parallax block for a class and a scroll timeline: the export uses .fp-pattern and the root scroller,
// the page's demo box its own class and named timeline. Empty without a second layer or without parallax.
export function exportParallax(i: ExportInput, cls = 'fp-pattern', timeline = 'scroll(root)'): string[] {
  return i.second && i.parallax ? parallaxBlock(i.motion, i.second, cls, timeline, i.sections === true) : [];
}

// Inserting a space breaks every comment delimiter and cannot create a new one.
const safe = (s: string) => s.replaceAll('*/', '* /').replaceAll('/*', '/ *');

export function exportCss(i: ExportInput): string {
  const drifting = i.motion.drift !== 'none';
  const plated = i.plate.mode !== 'direct';
  const size = scaledSize(i.tileSize, i.motion);
  const size2 = i.second ? scaledSize(i.second.tileSize, i.motion) : '';
  // A rectangular tile adds its height as --fp-size-y (and --fp-size-2-y); a square tile writes no extra line.
  const rect = i.tileHeight !== undefined && i.tileHeight !== i.tileSize;
  const rect2 = i.second?.tileHeight !== undefined && i.second.tileHeight !== i.second.tileSize;
  const layers = `.fp-pattern::before${i.second ? ', .fp-pattern::after' : ''} {`;
  const change = i.change && i.change.dir !== 'none' ? changeMask(i.change.dir, i.change.to) : undefined;
  return [
    `/* ${safe(i.appName)}: ${safe(i.label)}. Tile ${i.tileSize}px.${i.source ? ` Made with ${safe(i.source)}` : ''} */`,
    '.fp-pattern {',
    `  --fp-bg: ${i.background};`,
    `  --fp-ink: ${i.text};`,
    `  --fp-tile: url("${svgToDataUri(i.svg)}");`,
    `  --fp-size: ${size}px;`,
    ...(rect ? [`  --fp-size-y: ${scaledSize(i.tileHeight!, i.motion)}px;`] : []),
    ...(i.second ? [`  --fp-tile-2: url("${svgToDataUri(i.second.svg)}");`, `  --fp-size-2: ${size2}px;`] : []),
    ...(rect2 ? [`  --fp-size-2-y: ${scaledSize(i.second!.tileHeight!, i.motion)}px;`] : []),
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
      i.second
        ? {
            ...i.second,
            image: 'var(--fp-tile-2)',
            s: 'var(--fp-size-2)',
            ...(rect2 ? { sy: 'var(--fp-size-2-y)' } : {}),
            parallax: i.parallax === true,
          }
        : undefined,
      i.sections === true,
      rect ? 'var(--fp-size-y)' : 'var(--fp-size)',
    ),
    ...(i.fade
      ? [
          '',
          '/* Soft fade: a large, soft light and dark variation that dims the pattern in places, so the grid is harder to see. */',
          ...(change ? ['/* Slow change: the pattern fades slowly from one end of the element to the other. */'] : []),
          layers,
          ...fadeMask(Number(size), change).map((l) => `  ${l}`),
          '}',
        ]
      : change
        ? [
            '',
            '/* Slow change: the pattern fades slowly from one end of the element to the other. */',
            layers,
            `  -webkit-mask-image: ${change};`,
            `  mask-image: ${change};`,
            '}',
          ]
        : []),
    ...(plated ? ['', cssPlate(i.background, i.plate)] : []),
    ...(i.second && i.parallax
      ? [
          '',
          '/* Parallax on scroll needs Chrome or Edge 115, Safari 26, or Firefox 159. Other browsers show the two layers without it. */',
          ...exportParallax(i),
        ]
      : []),
    ...(i.sections
      ? [
          '',
          '/* Add fp-a, fp-b, or fp-c next to fp-pattern to turn the pattern on that section. */',
          // Steps of the golden angle (137.5 deg), modulo 180.
          '.fp-pattern.fp-a { --fp-turn: 137deg; }',
          '.fp-pattern.fp-b { --fp-turn: 95deg; }',
          '.fp-pattern.fp-c { --fp-turn: 52deg; }',
        ]
      : []),
    '',
    '/* Use: put class="fp-pattern" on the element that shows the pattern.',
    ...(plated ? [' * Put class="fp-plate" on the element that holds the text.'] : []),
    ...(i.sections ? [' * Add fp-a, fp-b, or fp-c on successive sections to show the pattern at a different angle on each.'] : []),
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
